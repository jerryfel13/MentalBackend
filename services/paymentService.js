const { supabase } = require('../config/supabase');
const crypto = require('crypto');

/**
 * Payment Service for GCash and PayMaya Integration
 * This service handles payment processing, verification, and status updates
 */

class PaymentService {
  /**
   * Initialize a payment transaction
   * Creates a payment record and generates payment details for GCash/PayMaya
   */
  async initializePayment(paymentData) {
    const {
      appointment_id,
      doctor_id,
      patient_id,
      amount,
      currency = 'PHP',
      payment_method
    } = paymentData;

    // Validate payment method
    if (!['gcash', 'paymaya'].includes(payment_method.toLowerCase())) {
      throw new Error('Invalid payment method. Only GCash and PayMaya are supported.');
    }

    // Enforce PHP currency only
    if (currency && currency.toUpperCase() !== 'PHP') {
      throw new Error('Only PHP (Philippine Peso) currency is supported.');
    }

    // Generate unique transaction ID
    const transactionId = this.generateTransactionId(payment_method);
    const paymentReference = this.generatePaymentReference();

    // Create payment record with pending status
    const paymentRecord = {
      appointment_id,
      doctor_id,
      patient_id,
      amount: parseFloat(amount),
      currency,
      payment_method: payment_method.toLowerCase(),
      payment_status: 'pending',
      transaction_id: transactionId,
      payment_intent_id: paymentReference,
      metadata: {
        payment_reference: paymentReference,
        initialized_at: new Date().toISOString(),
        payment_method: payment_method.toLowerCase()
      }
    };

    const { data: payment, error } = await supabase
      .from('payments')
      .insert([paymentRecord])
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create payment record: ${error.message}`);
    }

    // Generate payment details based on method
    const paymentDetails = await this.generatePaymentDetails(payment, payment_method);

    return {
      payment,
      payment_details: paymentDetails
    };
  }

  /**
   * Generate payment details for GCash or PayMaya
   */
  async generatePaymentDetails(payment, paymentMethod) {
    const method = paymentMethod.toLowerCase();
    
    if (method === 'gcash') {
      return {
        qr_code: this.generateQRCode(payment),
        payment_instructions: this.getGCashInstructions(payment),
        account_number: process.env.GCASH_ACCOUNT_NUMBER || '09123456789',
        account_name: process.env.GCASH_ACCOUNT_NAME || 'Mind You Healthcare',
        reference_number: payment.payment_intent_id,
        amount: payment.amount,
        expiry_minutes: 15
      };
    } else if (method === 'paymaya') {
      return {
        qr_code: this.generateQRCode(payment),
        payment_instructions: this.getPayMayaInstructions(payment),
        account_number: process.env.PAYMAYA_ACCOUNT_NUMBER || '09123456789',
        account_name: process.env.PAYMAYA_ACCOUNT_NAME || 'Mind You Healthcare',
        reference_number: payment.payment_intent_id,
        amount: payment.amount,
        expiry_minutes: 15
      };
    }

    throw new Error('Invalid payment method');
  }

  /**
   * Generate QR code data for payment
   */
  generateQRCode(payment) {
    // In production, use a QR code library like 'qrcode' to generate actual QR codes
    // For now, return a data structure that can be used to generate QR code
    const qrData = {
      type: payment.payment_method,
      amount: payment.amount,
      reference: payment.payment_intent_id,
      account: payment.payment_method === 'gcash' 
        ? (process.env.GCASH_ACCOUNT_NUMBER || '09123456789')
        : (process.env.PAYMAYA_ACCOUNT_NUMBER || '09123456789'),
      timestamp: new Date().toISOString()
    };

    // Return base64 encoded QR code data
    // In production, generate actual QR code image
    return Buffer.from(JSON.stringify(qrData)).toString('base64');
  }

  /**
   * Get GCash payment instructions
   */
  getGCashInstructions(payment) {
    return [
      'Open your GCash app',
      `Go to "Send Money"`,
      `Enter account number: ${process.env.GCASH_ACCOUNT_NUMBER || '09123456789'}`,
      `Enter amount: ₱${payment.amount.toFixed(2)}`,
      `Enter reference number: ${payment.payment_intent_id}`,
      'Confirm and send payment',
      'Wait for payment confirmation (usually within 1-2 minutes)'
    ];
  }

  /**
   * Get PayMaya payment instructions
   */
  getPayMayaInstructions(payment) {
    return [
      'Open your PayMaya app',
      `Go to "Send Money"`,
      `Enter mobile number: ${process.env.PAYMAYA_ACCOUNT_NUMBER || '09123456789'}`,
      `Enter amount: ₱${payment.amount.toFixed(2)}`,
      `Enter reference number: ${payment.payment_intent_id}`,
      'Confirm and send payment',
      'Wait for payment confirmation (usually within 1-2 minutes)'
    ];
  }

  /**
   * Verify payment status
   * In production, this would check with GCash/PayMaya API
   */
  async verifyPayment(paymentId, transactionId) {
    // Get payment record
    const { data: payment, error } = await supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (error || !payment) {
      throw new Error('Payment not found');
    }

    // In production, verify with payment gateway API
    // For now, simulate verification
    const isVerified = await this.checkPaymentWithGateway(payment);

    if (isVerified && payment.payment_status === 'pending') {
      // Update payment status to completed
      const updateData = {
        payment_status: 'completed',
        paid_at: new Date().toISOString(),
        receipt_url: this.generateReceiptUrl(payment)
      };

      const { data: updatedPayment, error: updateError } = await supabase
        .from('payments')
        .update(updateData)
        .eq('id', paymentId)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Failed to update payment: ${updateError.message}`);
      }

      return updatedPayment;
    }

    return payment;
  }

  /**
   * Check payment with gateway (GCash/PayMaya API)
   * In production, integrate with actual payment gateway APIs
   */
  async checkPaymentWithGateway(payment) {
    // TODO: Integrate with GCash/PayMaya API
    // For now, simulate payment verification
    // In production, make API call to verify transaction
    
    // Example GCash API call (pseudo-code):
    // const response = await fetch('https://api.gcash.com/verify', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${process.env.GCASH_API_KEY}`,
    //     'Content-Type': 'application/json'
    //   },
    //   body: JSON.stringify({
    //     transaction_id: payment.transaction_id,
    //     reference: payment.payment_intent_id
    //   })
    // });
    
    // For demo purposes, return false (payment not verified yet)
    // In production, return actual verification result
    return false;
  }

  /**
   * Process payment callback/webhook from payment gateway
   */
  async processPaymentWebhook(webhookData) {
    const {
      transaction_id,
      reference_number,
      status,
      amount,
      payment_method,
      timestamp
    } = webhookData;

    // Find payment by transaction_id or reference_number
    const { data: payment, error } = await supabase
      .from('payments')
      .select('*')
      .or(`transaction_id.eq.${transaction_id},payment_intent_id.eq.${reference_number}`)
      .single();

    if (error || !payment) {
      throw new Error('Payment not found');
    }

    // Verify webhook signature (in production)
    // const isValid = this.verifyWebhookSignature(webhookData);
    // if (!isValid) throw new Error('Invalid webhook signature');

    // Update payment status based on webhook
    let updateData = {
      payment_status: status.toLowerCase(),
      updated_at: new Date().toISOString()
    };

    if (status.toLowerCase() === 'completed' || status.toLowerCase() === 'success') {
      updateData.payment_status = 'completed';
      updateData.paid_at = timestamp || new Date().toISOString();
      updateData.receipt_url = this.generateReceiptUrl(payment);
    } else if (status.toLowerCase() === 'failed' || status.toLowerCase() === 'cancelled') {
      updateData.payment_status = status.toLowerCase();
      updateData.failure_reason = webhookData.failure_reason || 'Payment failed';
    }

    const { data: updatedPayment, error: updateError } = await supabase
      .from('payments')
      .update(updateData)
      .eq('id', payment.id)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update payment: ${updateError.message}`);
    }

    return updatedPayment;
  }

  /**
   * Generate unique transaction ID
   */
  generateTransactionId(paymentMethod) {
    const prefix = paymentMethod === 'gcash' ? 'GC' : 'PM';
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `${prefix}${timestamp}${random}`;
  }

  /**
   * Generate payment reference number
   */
  generatePaymentReference() {
    const timestamp = Date.now();
    const random = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `REF${timestamp}${random}`;
  }

  /**
   * Generate receipt URL
   */
  generateReceiptUrl(payment) {
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    return `${baseUrl}/payments/receipt/${payment.id}`;
  }

  /**
   * Verify webhook signature (for production)
   */
  verifyWebhookSignature(webhookData, signature) {
    // In production, verify webhook signature from payment gateway
    // const expectedSignature = crypto
    //   .createHmac('sha256', process.env.PAYMENT_WEBHOOK_SECRET)
    //   .update(JSON.stringify(webhookData))
    //   .digest('hex');
    // return signature === expectedSignature;
    return true; // For development
  }

  /**
   * Cancel/refund a payment
   */
  async cancelPayment(paymentId, reason) {
    const { data: payment, error } = await supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (error || !payment) {
      throw new Error('Payment not found');
    }

    if (payment.payment_status === 'completed') {
      // Process refund
      const refundData = {
        payment_status: 'refunded',
        refund_amount: payment.amount,
        refunded_at: new Date().toISOString(),
        failure_reason: reason || 'Payment cancelled by user'
      };

      const { data: updatedPayment, error: updateError } = await supabase
        .from('payments')
        .update(refundData)
        .eq('id', paymentId)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Failed to refund payment: ${updateError.message}`);
      }

      return updatedPayment;
    } else {
      // Just cancel pending payment
      const cancelData = {
        payment_status: 'cancelled',
        failure_reason: reason || 'Payment cancelled by user'
      };

      const { data: updatedPayment, error: updateError } = await supabase
        .from('payments')
        .update(cancelData)
        .eq('id', paymentId)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Failed to cancel payment: ${updateError.message}`);
      }

      return updatedPayment;
    }
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(paymentId) {
    const { data: payment, error } = await supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (error || !payment) {
      throw new Error('Payment not found');
    }

    return {
      id: payment.id,
      payment_status: payment.payment_status,
      status: payment.payment_status,
      amount: payment.amount,
      currency: payment.currency,
      payment_method: payment.payment_method,
      transaction_id: payment.transaction_id,
      reference_number: payment.payment_intent_id,
      paid_at: payment.paid_at,
      created_at: payment.created_at,
      patient_id: payment.patient_id
    };
  }
}

module.exports = new PaymentService();

