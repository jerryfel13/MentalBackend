const { supabase } = require('../config/supabase');
const paymentService = require('../services/paymentService');
const paymentProgressService = require('../services/paymentProgressService');

const paymentController = {
  // ========== PATIENT-SIDE PAYMENT METHODS ==========

  // Get all payments for a patient
  getPatientPayments: async (req, res, next) => {
    try {
      const patientId = req.user.id; // From auth middleware
      const { status, start_date, end_date, limit = 50, offset = 0 } = req.query;

      let query = supabase
        .from('payments')
        .select(`
          *,
          appointment:appointments(*),
          doctor:users!payments_doctor_id_fkey(id, full_name, email_address, specialization)
        `)
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      // Apply filters
      if (status) {
        query = query.eq('payment_status', status);
      }
      if (start_date) {
        query = query.gte('created_at', start_date);
      }
      if (end_date) {
        query = query.lte('created_at', end_date);
      }

      const { data, error } = await query;

      if (error) {
        error.status = 500;
        throw error;
      }

      res.json({
        message: 'Payments retrieved successfully',
        count: data?.length || 0,
        data: data || []
      });
    } catch (error) {
      next(error);
    }
  },

  // Get payment statistics for a patient
  getPatientPaymentStats: async (req, res, next) => {
    try {
      const patientId = req.user.id;
      const { start_date, end_date } = req.query;

      // Build base query
      let query = supabase
        .from('payments')
        .select('amount, payment_status, created_at')
        .eq('patient_id', patientId);

      if (start_date) {
        query = query.gte('created_at', start_date);
      }
      if (end_date) {
        query = query.lte('created_at', end_date);
      }

      const { data: payments, error } = await query;

      if (error) {
        error.status = 500;
        throw error;
      }

      // Calculate statistics
      const stats = {
        total_paid: 0,
        completed_payments: 0,
        pending_payments: 0,
        failed_payments: 0,
        refunded_amount: 0,
        total_transactions: payments?.length || 0,
        this_month_paid: 0,
        this_year_paid: 0
      };

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfYear = new Date(now.getFullYear(), 0, 1);

      payments?.forEach(payment => {
        const paymentDate = new Date(payment.created_at);
        const amount = parseFloat(payment.amount) || 0;

        if (payment.payment_status === 'completed') {
          stats.total_paid += amount;
          stats.completed_payments += 1;

          if (paymentDate >= startOfMonth) {
            stats.this_month_paid += amount;
          }
          if (paymentDate >= startOfYear) {
            stats.this_year_paid += amount;
          }
        } else if (payment.payment_status === 'pending' || payment.payment_status === 'processing') {
          stats.pending_payments += 1;
        } else if (payment.payment_status === 'failed' || payment.payment_status === 'cancelled') {
          stats.failed_payments += 1;
        }

        if (payment.payment_status === 'refunded' && payment.refund_amount) {
          stats.refunded_amount += parseFloat(payment.refund_amount) || 0;
        }
      });

      res.json({
        message: 'Payment statistics retrieved successfully',
        data: stats
      });
    } catch (error) {
      next(error);
    }
  },

  // Get payment by appointment ID (for patients)
  getPaymentByAppointmentId: async (req, res, next) => {
    try {
      const { appointmentId } = req.params;
      const patientId = req.user.id;

      const { data: payment, error } = await supabase
        .from('payments')
        .select(`
          *,
          appointment:appointments(*),
          doctor:users!payments_doctor_id_fkey(id, full_name, email_address, specialization, consultation_fee)
        `)
        .eq('appointment_id', appointmentId)
        .eq('patient_id', patientId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.json({
            message: 'No payment found for this appointment',
            data: null
          });
        }
        error.status = 500;
        throw error;
      }

      res.json({
        message: 'Payment retrieved successfully',
        data: payment
      });
    } catch (error) {
      next(error);
    }
  },

  // Initialize payment (create payment record and get payment details)
  initializePayment: async (req, res, next) => {
    try {
      const {
        appointment_id,
        payment_method,
        cp_number
      } = req.body;

      const patientId = req.user.id;

      // Validate required fields
      if (!appointment_id || !payment_method || !cp_number) {
        return res.status(400).json({
          error: 'Missing required fields',
          message: 'appointment_id, payment_method, and cp_number are required'
        });
      }

      // Validate payment method
      if (!['gcash', 'paymaya'].includes(payment_method.toLowerCase())) {
        return res.status(400).json({
          error: 'Invalid payment method',
          message: 'Only GCash and PayMaya are supported'
        });
      }

      // Get appointment details
      const { data: appointment, error: appointmentError } = await supabase
        .from('appointments')
        .select('doctor_id, user_id')
        .eq('id', appointment_id)
        .single();

      if (appointmentError || !appointment) {
        return res.status(404).json({
          error: 'Appointment not found',
          message: `No appointment found with ID: ${appointment_id}`
        });
      }

      // Verify the patient owns this appointment
      if (appointment.user_id !== patientId) {
        return res.status(403).json({
          error: 'Unauthorized',
          message: 'You can only create payments for your own appointments'
        });
      }

      // Check if payment already exists
      const { data: existingPayment } = await supabase
        .from('payments')
        .select('id, payment_status')
        .eq('appointment_id', appointment_id)
        .eq('patient_id', patientId)
        .single();

      if (existingPayment) {
        // If payment exists and is pending, return existing payment details
        if (existingPayment.payment_status === 'pending') {
          const paymentDetails = await paymentService.generatePaymentDetails(
            existingPayment,
            payment_method
          );
          return res.json({
            message: 'Payment already initialized',
            data: {
              payment: existingPayment,
              payment_details: paymentDetails
            }
          });
        }
        return res.status(400).json({
          error: 'Payment already exists',
          message: 'A payment record already exists for this appointment',
          data: existingPayment
        });
      }

      // Get doctor's consultation fee
      const { data: doctor } = await supabase
        .from('users')
        .select('consultation_fee')
        .eq('id', appointment.doctor_id)
        .single();

      if (!doctor || !doctor.consultation_fee) {
        return res.status(400).json({
          error: 'Consultation fee not set',
          message: 'Doctor consultation fee is not available'
        });
      }

      // Validate CP number - must be exactly 11 digits starting with 09
      if (!cp_number) {
        return res.status(400).json({
          error: 'Missing CP number',
          message: 'Mobile number is required'
        });
      }

      // Clean and validate Philippine mobile number format (exactly 11 digits)
      const cleanedCpNumber = cp_number.replace(/[\s\-\(\)\+]/g, '');
      
      // Must be exactly 11 digits starting with 09
      if (cleanedCpNumber.length !== 11) {
        return res.status(400).json({
          error: 'Invalid mobile number length',
          message: 'Mobile number must be exactly 11 digits (e.g., 09123456789)'
        });
      }

      const phMobileRegex = /^09[0-9]{9}$/;
      
      if (!phMobileRegex.test(cleanedCpNumber)) {
        return res.status(400).json({
          error: 'Invalid mobile number format',
          message: 'Mobile number must start with 09 and be exactly 11 digits'
        });
      }

      // Initialize payment using payment service (PHP currency only)
      // This will also notify the doctor about the payment confirmation
      const result = await paymentService.initializePayment({
        appointment_id,
        doctor_id: appointment.doctor_id,
        patient_id: patientId,
        amount: doctor.consultation_fee,
        currency: 'PHP', // PHP currency only
        payment_method,
        cp_number: cp_number ? cp_number.replace(/[\s\-\(\)]/g, '') : null
      });

      res.status(201).json({
        message: 'Payment confirmed successfully. Doctor has been notified.',
        data: result
      });
    } catch (error) {
      next(error);
    }
  },

  // Verify payment status
  verifyPayment: async (req, res, next) => {
    try {
      const { paymentId } = req.params;
      const patientId = req.user.id;

      // Get payment and verify ownership
      const { data: payment, error } = await supabase
        .from('payments')
        .select('*')
        .eq('id', paymentId)
        .eq('patient_id', patientId)
        .single();

      if (error || !payment) {
        return res.status(404).json({
          error: 'Payment not found',
          message: 'Payment not found or you do not have access to it'
        });
      }

      // Verify payment with gateway
      const verifiedPayment = await paymentService.verifyPayment(
        paymentId,
        payment.transaction_id
      );

      res.json({
        message: 'Payment status retrieved',
        data: verifiedPayment
      });
    } catch (error) {
      next(error);
    }
  },

  // Process payment webhook (for GCash/PayMaya callbacks)
  processPaymentWebhook: async (req, res, next) => {
    try {
      const webhookData = req.body;
      const signature = req.headers['x-payment-signature'] || req.headers['x-webhook-signature'];

      // Process webhook
      const updatedPayment = await paymentService.processPaymentWebhook(webhookData);

      res.json({
        message: 'Webhook processed successfully',
        data: updatedPayment
      });
    } catch (error) {
      next(error);
    }
  },

  // Cancel payment
  cancelPayment: async (req, res, next) => {
    try {
      const { paymentId } = req.params;
      const { reason } = req.body;
      const patientId = req.user.id;

      // Verify payment ownership
      const { data: payment, error } = await supabase
        .from('payments')
        .select('*')
        .eq('id', paymentId)
        .eq('patient_id', patientId)
        .single();

      if (error || !payment) {
        return res.status(404).json({
          error: 'Payment not found',
          message: 'Payment not found or you do not have access to it'
        });
      }

      // Cancel payment
      const cancelledPayment = await paymentService.cancelPayment(paymentId, reason);

      res.json({
        message: 'Payment cancelled successfully',
        data: cancelledPayment
      });
    } catch (error) {
      next(error);
    }
  },

  // Get payment status
  getPaymentStatus: async (req, res, next) => {
    try {
      const { paymentId } = req.params;
      const patientId = req.user.id;

      // Get payment and verify ownership
      const { data: payment, error } = await supabase
        .from('payments')
        .select('*')
        .eq('id', paymentId)
        .eq('patient_id', patientId)
        .single();

      if (error || !payment) {
        return res.status(404).json({
          error: 'Payment not found',
          message: 'Payment not found or you do not have access to it'
        });
      }

      const status = await paymentService.getPaymentStatus(paymentId);

      res.json({
        message: 'Payment status retrieved',
        data: status
      });
    } catch (error) {
      next(error);
    }
  },

  // Get payment progress
  getPaymentProgress: async (req, res, next) => {
    try {
      const { paymentId } = req.params;
      const patientId = req.user.id;

      // Verify payment ownership
      const { data: payment, error } = await supabase
        .from('payments')
        .select('id')
        .eq('id', paymentId)
        .eq('patient_id', patientId)
        .single();

      if (error || !payment) {
        return res.status(404).json({
          error: 'Payment not found',
          message: 'Payment not found or you do not have access to it'
        });
      }

      const progress = await paymentProgressService.getPaymentProgress(paymentId);

      res.json({
        message: 'Payment progress retrieved',
        data: progress
      });
    } catch (error) {
      next(error);
    }
  },

  // Get payment timeline
  getPaymentTimeline: async (req, res, next) => {
    try {
      const { paymentId } = req.params;
      const patientId = req.user.id;

      // Verify payment ownership
      const { data: payment, error } = await supabase
        .from('payments')
        .select('id')
        .eq('id', paymentId)
        .eq('patient_id', patientId)
        .single();

      if (error || !payment) {
        return res.status(404).json({
          error: 'Payment not found',
          message: 'Payment not found or you do not have access to it'
        });
      }

      const timeline = await paymentProgressService.getPaymentTimeline(paymentId);

      res.json({
        message: 'Payment timeline retrieved',
        data: timeline
      });
    } catch (error) {
      next(error);
    }
  },

  // Create payment from patient side (legacy - for backward compatibility)
  createPaymentFromPatient: async (req, res, next) => {
    try {
      const {
        appointment_id,
        amount,
        currency = 'PHP',
        payment_method,
        cp_number,
        transaction_id,
        payment_intent_id,
        receipt_url,
        metadata
      } = req.body;

      const patientId = req.user.id;

      // Validate required fields
      if (!appointment_id || !amount || !payment_method) {
        return res.status(400).json({
          error: 'Missing required fields',
          message: 'appointment_id, amount, and payment_method are required'
        });
      }

      // Validate payment method - only GCash and PayMaya allowed
      if (!['gcash', 'paymaya'].includes(payment_method.toLowerCase())) {
        return res.status(400).json({
          error: 'Invalid payment method',
          message: 'Only GCash and PayMaya are supported'
        });
      }

      // Enforce PHP currency only
      if (currency && currency.toUpperCase() !== 'PHP') {
        return res.status(400).json({
          error: 'Invalid currency',
          message: 'Only PHP (Philippine Peso) currency is supported'
        });
      }

      // Validate CP number if provided (exactly 11 digits starting with 09)
      if (cp_number) {
        const cleanedCpNumber = cp_number.replace(/[\s\-\(\)\+]/g, '');
        
        if (cleanedCpNumber.length !== 11) {
          return res.status(400).json({
            error: 'Invalid mobile number length',
            message: 'Mobile number must be exactly 11 digits (e.g., 09123456789)'
          });
        }

        const phMobileRegex = /^09[0-9]{9}$/;
        
        if (!phMobileRegex.test(cleanedCpNumber)) {
          return res.status(400).json({
            error: 'Invalid mobile number format',
            message: 'Mobile number must start with 09 and be exactly 11 digits'
          });
        }
      }

      // Get appointment details to verify ownership and get doctor_id
      const { data: appointment, error: appointmentError } = await supabase
        .from('appointments')
        .select('doctor_id, user_id')
        .eq('id', appointment_id)
        .single();

      if (appointmentError || !appointment) {
        return res.status(404).json({
          error: 'Appointment not found',
          message: `No appointment found with ID: ${appointment_id}`
        });
      }

      // Verify the patient owns this appointment
      if (appointment.user_id !== patientId) {
        return res.status(403).json({
          error: 'Unauthorized',
          message: 'You can only create payments for your own appointments'
        });
      }

      // Check if payment already exists for this appointment
      const { data: existingPayment } = await supabase
        .from('payments')
        .select('id')
        .eq('appointment_id', appointment_id)
        .eq('patient_id', patientId)
        .single();

      if (existingPayment) {
        return res.status(400).json({
          error: 'Payment already exists',
          message: 'A payment record already exists for this appointment',
          data: existingPayment
        });
      }

      // Create payment record
      const paymentData = {
        appointment_id,
        doctor_id: appointment.doctor_id,
        patient_id: patientId,
        amount: parseFloat(amount),
        currency,
        payment_method,
        payment_status: 'completed',
        transaction_id,
        payment_intent_id,
        receipt_url,
        paid_at: new Date().toISOString(),
        metadata: {
          ...(metadata || {}),
          cp_number: cp_number ? cp_number.replace(/[\s\-\(\)\+]/g, '') : null
        }
      };

      const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .insert([paymentData])
        .select()
        .single();

      if (paymentError) {
        paymentError.status = 500;
        throw paymentError;
      }

      res.status(201).json({
        message: 'Payment created successfully',
        data: payment
      });
    } catch (error) {
      next(error);
    }
  },

  // Get patient payment history with filters
  getPatientPaymentHistory: async (req, res, next) => {
    try {
      const patientId = req.user.id;
      const {
        status,
        payment_method,
        start_date,
        end_date,
        limit = 50,
        offset = 0,
        sort_by = 'created_at',
        sort_order = 'desc'
      } = req.query;

      let query = supabase
        .from('payments')
        .select(`
          *,
          appointment:appointments(id, appointment_date, appointment_time, appointment_type, status),
          doctor:users!payments_doctor_id_fkey(id, full_name, email_address, specialization)
        `)
        .eq('patient_id', patientId)
        .order(sort_by, { ascending: sort_order === 'asc' })
        .range(offset, offset + limit - 1);

      // Apply filters
      if (status) {
        query = query.eq('payment_status', status);
      }
      if (payment_method) {
        query = query.eq('payment_method', payment_method);
      }
      if (start_date) {
        query = query.gte('created_at', start_date);
      }
      if (end_date) {
        query = query.lte('created_at', end_date);
      }

      const { data: payments, error } = await query;

      if (error) {
        error.status = 500;
        throw error;
      }

      // Get total count for pagination
      let countQuery = supabase
        .from('payments')
        .select('id', { count: 'exact', head: true })
        .eq('patient_id', patientId);

      if (status) countQuery = countQuery.eq('payment_status', status);
      if (payment_method) countQuery = countQuery.eq('payment_method', payment_method);
      if (start_date) countQuery = countQuery.gte('created_at', start_date);
      if (end_date) countQuery = countQuery.lte('created_at', end_date);

      const { count } = await countQuery;

      res.json({
        message: 'Payment history retrieved successfully',
        data: payments || [],
        pagination: {
          total: count || 0,
          limit: parseInt(limit),
          offset: parseInt(offset),
          has_more: (count || 0) > offset + parseInt(limit)
        }
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = paymentController;

