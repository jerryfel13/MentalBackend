const { supabase } = require('../config/supabase');

// Helper function to enrich appointments with user data
const enrichAppointmentsWithUsers = async (appointments) => {
  if (!appointments || appointments.length === 0) {
    return appointments;
  }
    

  const doctorIds = [...new Set(appointments.map(apt => apt.doctor_id))];
  const patientIds = [...new Set(appointments.map(apt => apt.user_id))];
  const allUserIds = [...new Set([...doctorIds, ...patientIds])];

  // Fetch all related users
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, full_name, email_address, role, contact_number')
    .in('id', allUserIds);

  if (!usersError && users) {
    // Map user data to appointments
    const usersMap = new Map(users.map(u => [u.id, u]));
    appointments.forEach(apt => {
      apt.doctor = usersMap.get(apt.doctor_id) || null;
      apt.user = usersMap.get(apt.user_id) || null;
    });
  }

  return appointments;
};

const appointmentController = {
  // Get all appointments (admin only)
  getAll: async (req, res, next) => {
    try {
      const { status, upcoming } = req.query;

      let query = supabase
        .from('appointments')
        .select('*')
        .order('appointment_date', { ascending: false })
        .order('appointment_time', { ascending: false });

      // Apply status filter
      if (status) {
        query = query.eq('status', status);
      }

      // Filter for upcoming appointments
      if (upcoming === 'true') {
        const today = new Date().toISOString().split('T')[0];
        query = query.gte('appointment_date', today);
      }

      const { data: appointments, error } = await query;

      if (error) {
        error.status = 500;
        throw error;
      }

      // Enrich appointments with user data
      await enrichAppointmentsWithUsers(appointments);

      res.json({
        message: 'Appointments retrieved successfully',
        count: appointments?.length || 0,
        data: appointments || []
      });
    } catch (error) {
      next(error);
    }
  },

  // Get all appointments for a user
  getByUserId: async (req, res, next) => {
    try {
      const { userId } = req.params;
      const { status, upcoming } = req.query;

      // Fetch appointments first
      let query = supabase
        .from('appointments')
        .select('*')
        .eq('user_id', userId)
        .order('appointment_date', { ascending: true })
        .order('appointment_time', { ascending: true });

      // Apply status filter
      if (status) {
        query = query.eq('status', status);
      }

      // Filter for upcoming appointments
      if (upcoming === 'true') {
        const today = new Date().toISOString().split('T')[0];
        query = query.gte('appointment_date', today);
      }

      const { data: appointments, error } = await query;

      if (error) {
        error.status = 500;
        throw error;
      }

      // Enrich appointments with user data
      await enrichAppointmentsWithUsers(appointments);

      res.json({
        message: 'Appointments retrieved successfully',
        count: appointments?.length || 0,
        data: appointments || []
      });
    } catch (error) {
      next(error);
    }
  },

  // Get all appointments for a doctor (by doctor_id from doctors table)
  getByDoctorId: async (req, res, next) => {
    try {
      const { doctorId } = req.params;
      const { status, upcoming } = req.query;

      let query = supabase
        .from('appointments')
        .select('*')
        .eq('doctor_id', doctorId)
        .order('appointment_date', { ascending: true })
        .order('appointment_time', { ascending: true });

      // Apply status filter
      if (status) {
        query = query.eq('status', status);
      }

      // Filter for upcoming appointments
      if (upcoming === 'true') {
        const today = new Date().toISOString().split('T')[0];
        query = query.gte('appointment_date', today);
      }

      const { data: appointments, error } = await query;

      if (error) {
        error.status = 500;
        throw error;
      }

      // Enrich appointments with user data
      await enrichAppointmentsWithUsers(appointments);

      res.json({
        message: 'Appointments retrieved successfully',
        count: appointments?.length || 0,
        data: appointments || []
      });
    } catch (error) {
      next(error);
    }
  },

  // Get all appointments for a doctor user (by user_id from users table where role='doctor')
  getByDoctorUserId: async (req, res, next) => {
    try {
      const { userId } = req.params;
      const { status, upcoming } = req.query;
      const authenticatedUserId = req.user?.id;

      console.log(`[getByDoctorUserId] Request received:`);
      console.log(`  - Route userId: ${userId}`);
      console.log(`  - Authenticated userId: ${authenticatedUserId}`);
      console.log(`  - Filters: status=${status}, upcoming=${upcoming}`);

      // Security check: Ensure authenticated user matches the requested userId
      if (authenticatedUserId && authenticatedUserId !== userId) {
        console.warn(`[getByDoctorUserId] Security warning: Authenticated user ${authenticatedUserId} requested appointments for different user ${userId}`);
        // Allow it for now, but log it
      }

      // First verify the user is a doctor
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, role, full_name, email_address')
        .eq('id', userId)
        .single();

      if (userError || !user) {
        console.error(`[getByDoctorUserId] User not found: ${userId}`, userError);
        return res.status(404).json({
          error: 'User not found',
          message: 'User not found'
        });
      }

      console.log(`[getByDoctorUserId] User found:`, { id: user.id, role: user.role, name: user.full_name });

      if (user.role !== 'doctor') {
        console.warn(`[getByDoctorUserId] User ${userId} is not a doctor (role: ${user.role})`);
        return res.status(403).json({
          error: 'Forbidden',
          message: 'User is not a doctor'
        });
      }

      // Get appointments where doctor_id matches the user_id from users table
      console.log(`[getByDoctorUserId] Querying appointments with doctor_id = ${userId}`);
      
      let query = supabase
        .from('appointments')
        .select('*')
        .eq('doctor_id', userId)
        .order('appointment_date', { ascending: true })
        .order('appointment_time', { ascending: true });

      // Apply status filter
      if (status) {
        query = query.eq('status', status);
        console.log(`[getByDoctorUserId] Applied status filter: ${status}`);
      }

      // Filter for upcoming appointments
      if (upcoming === 'true') {
        const today = new Date().toISOString().split('T')[0];
        query = query.gte('appointment_date', today);
        console.log(`[getByDoctorUserId] Applied upcoming filter: >= ${today}`);
      }

      const { data: appointments, error } = await query;

      if (error) {
        console.error(`[getByDoctorUserId] Error fetching appointments:`, error);
        error.status = 500;
        throw error;
      }

      console.log(`[getByDoctorUserId] Raw query result:`, {
        count: appointments?.length || 0,
        appointments: appointments?.map(a => ({
          id: a.id,
          doctor_id: a.doctor_id,
          appointment_date: a.appointment_date,
          appointment_time: a.appointment_time,
          status: a.status
        }))
      });

      // Enrich appointments with user data
      await enrichAppointmentsWithUsers(appointments);

      console.log(`[getByDoctorUserId] Returning ${appointments?.length || 0} appointments`);

      res.json({
        message: 'Appointments retrieved successfully',
        count: appointments?.length || 0,
        data: appointments || []
      });
    } catch (error) {
      console.error(`[getByDoctorUserId] Exception:`, error);
      next(error);
    }
  },

  // Get appointment by ID
  getById: async (req, res, next) => {
    try {
      const { id } = req.params;

      const { data: appointment, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({
            error: 'Appointment not found',
            message: `No appointment found with ID: ${id}`
          });
        }
        error.status = 500;
        throw error;
      }

      // Enrich appointment with user data
      await enrichAppointmentsWithUsers([appointment]);

      res.json({
        message: 'Appointment retrieved successfully',
        data: appointment
      });
    } catch (error) {
      next(error);
    }
  },

  // Create new appointment
  create: async (req, res, next) => {
    try {
      const {
        user_id: body_user_id, // user_id from request body (optional, will use authenticated user if not provided)
        doctor_id,
        appointment_date,
        appointment_time,
        duration_minutes,
        appointment_type,
        status,
        notes,
        meeting_room_id
      } = req.body;

      // Get authenticated user ID (from JWT token)
      const authenticatedUserId = req.user?.id;
      
      if (!authenticatedUserId) {
        return res.status(401).json({
          error: 'Authentication Error',
          message: 'User must be authenticated to create an appointment.'
        });
      }

      // Use authenticated user's ID as the patient/user_id (not from body to prevent ID swapping)
      // If body_user_id is provided and doesn't match authenticated user, reject it for security
      const patientUserId = authenticatedUserId;
      
      if (body_user_id && body_user_id !== authenticatedUserId) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You can only create appointments for yourself. user_id must match authenticated user.'
        });
      }

      // Validate required fields
      if (!doctor_id || !appointment_date || !appointment_time) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'doctor_id, appointment_date, and appointment_time are required',
          required_fields: ['doctor_id', 'appointment_date', 'appointment_time']
        });
      }

      // Verify patient exists and is NOT a doctor (patients book appointments, doctors receive them)
      const { data: patient, error: patientError } = await supabase
        .from('users')
        .select('id, full_name, role')
        .eq('id', patientUserId)
        .single();

      if (patientError || !patient) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid user. Patient not found.'
        });
      }

      // CRITICAL: Ensure the user_id is NOT a doctor (prevent ID swapping bug)
      if (patient.role === 'doctor') {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Doctors cannot book appointments as patients. user_id must be a patient (role="user"), not a doctor.'
        });
      }

      // Verify doctor exists in users table (since doctor_id now references users table)
      const { data: doctor, error: doctorError } = await supabase
        .from('users')
        .select('id, full_name, role')
        .eq('id', doctor_id)
        .single();

      if (doctorError || !doctor) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid doctor_id. Doctor not found.'
        });
      }

      // Verify the doctor_id points to an actual doctor
      if (doctor.role !== 'doctor' && doctor.role !== 'admin') {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'The specified user is not a doctor.'
        });
      }

      // CRITICAL: Ensure patient and doctor are different people
      if (patientUserId === doctor_id) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Cannot create appointment: patient and doctor cannot be the same person.'
        });
      }

      // Generate meeting room ID if not provided (for video calls)
      const roomId = meeting_room_id || `room-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Create new appointment (doctor_name column is optional/removed, we use doctor_id instead)
      // Use patientUserId (authenticated user) instead of body user_id to prevent ID swapping
      const { data, error } = await supabase
        .from('appointments')
        .insert({
          user_id: patientUserId, // Always use authenticated user's ID as patient
          doctor_id,
          // doctor_name is no longer needed - we can get it from doctor_id via users table
          appointment_date,
          appointment_time,
          duration_minutes: duration_minutes || 60,
          appointment_type: appointment_type || 'Video Call',
          status: status || 'scheduled',
          notes,
          meeting_room_id: roomId,
          session_link: appointment_type === 'Video Call' ? `/appointments/video-call?id=${roomId}` : null
        })
        .select('*')
        .single();

      if (error) {
        if (error.code === '23505') {
          return res.status(409).json({
            error: 'Appointment Conflict',
            message: 'This time slot is already booked for this doctor'
          });
        }
        error.status = 500;
        throw error;
      }

      // Enrich appointment with user data
      await enrichAppointmentsWithUsers([data]);

      res.status(201).json({
        success: true,
        message: 'Appointment created successfully',
        data: data
      });
    } catch (error) {
      next(error);
    }
  },

  // Update appointment
  update: async (req, res, next) => {
    try {
      const { id } = req.params;
      const {
        appointment_date,
        appointment_time,
        duration_minutes,
        appointment_type,
        status,
        notes,
        session_link,
        meeting_room_id
      } = req.body;

      const updateData = {};
      if (appointment_date !== undefined) updateData.appointment_date = appointment_date;
      if (appointment_time !== undefined) updateData.appointment_time = appointment_time;
      if (duration_minutes !== undefined) updateData.duration_minutes = duration_minutes;
      if (appointment_type !== undefined) updateData.appointment_type = appointment_type;
      if (status !== undefined) updateData.status = status;
      if (notes !== undefined) updateData.notes = notes;
      if (session_link !== undefined) updateData.session_link = session_link;
      if (meeting_room_id !== undefined) updateData.meeting_room_id = meeting_room_id;

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'No fields to update'
        });
      }

      const { data: appointment, error } = await supabase
        .from('appointments')
        .update(updateData)
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({
            error: 'Appointment not found',
            message: `No appointment found with ID: ${id}`
          });
        }
        error.status = 500;
        throw error;
      }

      // Enrich appointment with user data
      await enrichAppointmentsWithUsers([appointment]);

      // Notify patient if doctor accepts appointment
      if (status && status.toLowerCase() === 'confirmed' && appointment.status?.toLowerCase() !== 'confirmed') {
        try {
          const notificationService = require('../services/notificationService');
          const { data: doctor } = await supabase
            .from('users')
            .select('full_name')
            .eq('id', appointment.doctor_id)
            .single();
          
          if (doctor) {
            await notificationService.notifyAppointmentAccepted(appointment.id, doctor.full_name);
          }
        } catch (error) {
          console.error('Error sending appointment acceptance notification:', error);
          // Don't fail the request if notification fails
        }
      }

      res.json({
        message: 'Appointment updated successfully',
        data: appointment
      });
    } catch (error) {
      next(error);
    }
  },

  // Delete/Cancel appointment
  delete: async (req, res, next) => {
    try {
      const { id } = req.params;

      // Instead of deleting, update status to cancelled
      const { data, error } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        error.status = 500;
        throw error;
      }

      if (!data) {
        return res.status(404).json({
          error: 'Appointment not found',
          message: `No appointment found with ID: ${id}`
        });
      }

      res.json({
        message: 'Appointment cancelled successfully',
        data: data
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = appointmentController;



