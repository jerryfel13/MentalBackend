const { supabase } = require('../config/supabase');
const bcrypt = require('bcrypt');
const { generateToken } = require('../middleware/auth');

const doctorController = {
  // Get all doctors
  getAll: async (req, res, next) => {
    try {
      const { specialization, is_active, is_verified, mental_health_specialty } = req.query;

      let query = supabase
        .from('doctors')
        .select('*')
        .order('created_at', { ascending: false });

      if (specialization) query = query.ilike('specialization', `%${specialization}%`);
      if (is_active !== undefined) query = query.eq('is_active', is_active === 'true');
      if (is_verified !== undefined) query = query.eq('is_verified', is_verified === 'true');
      
      // Filter by mental health specialty (searches within the JSONB array)
      if (mental_health_specialty) {
        query = query.contains('mental_health_specialties', [mental_health_specialty]);
      }

      const { data, error } = await query;

      if (error) throw error;

      const doctors = (data || []).map(({ password_hash, ...doctor }) => doctor);

      res.json({ message: 'Doctors retrieved successfully', count: doctors.length, data: doctors });
    } catch (error) {
      next(error);
    }
  },

  // Get available doctors
  getAvailable: async (req, res, next) => {
    try {
      const { specialization, mental_health_specialty } = req.query;

      let query = supabase
        .from('doctors')
        .select('*')
        .eq('is_active', true)
        .eq('is_verified', true)
        .order('full_name', { ascending: true });

      if (specialization) query = query.ilike('specialization', `%${specialization}%`);
      
      // Filter by mental health specialty (searches within the JSONB array)
      if (mental_health_specialty) {
        query = query.contains('mental_health_specialties', [mental_health_specialty]);
      }

      const { data, error } = await query;

      if (error) throw error;

      const doctors = (data || []).map(({ password_hash, ...doctor }) => doctor);

      res.json({ message: 'Available doctors retrieved successfully', count: doctors.length, data: doctors });
    } catch (error) {
      next(error);
    }
  },

  // Get doctor by ID
  getById: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { data, error } = await supabase.from('doctors').select('*').eq('id', id).single();

      if (error) return res.status(404).json({ error: 'Doctor not found', message: `No doctor found with ID: ${id}` });

      const { password_hash, ...doctor } = data;
      res.json({ message: 'Doctor retrieved successfully', data: doctor });
    } catch (error) {
      next(error);
    }
  },

  // Register doctor
  register: async (req, res, next) => {
    try {
      const {
        full_name, email_address, password, phone_number,
        specialization, license_number, qualifications,
        bio, years_of_experience, consultation_fee, profile_image_url,
        mental_health_specialties
      } = req.body;

      if (!full_name || !email_address || !password || !specialization || !license_number) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Required: full_name, email_address, password, specialization, license_number'
        });
      }

      if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

      // Validate mental_health_specialties if provided (should be an array)
      if (mental_health_specialties !== undefined && !Array.isArray(mental_health_specialties)) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'mental_health_specialties must be an array (e.g., ["Anxiety", "Depression"])'
        });
      }

      const { data: existingDoctor } = await supabase.from('doctors').select('email_address').eq('email_address', email_address).single();
      if (existingDoctor) return res.status(409).json({ error: 'A doctor with this email already exists' });

      const { data: existingLicense } = await supabase.from('doctors').select('license_number').eq('license_number', license_number).single();
      if (existingLicense) return res.status(409).json({ error: 'A doctor with this license number already exists' });

      const password_hash = await bcrypt.hash(password, 10);

      // Prepare insert data
      const insertData = {
        full_name, email_address, password_hash, phone_number,
        specialization, license_number, qualifications, bio,
        years_of_experience, consultation_fee, profile_image_url,
        is_active: true, is_verified: false
      };

      // Add mental_health_specialties if provided (defaults to empty array from migration)
      if (mental_health_specialties !== undefined) {
        insertData.mental_health_specialties = mental_health_specialties;
      }

      const { data, error } = await supabase.from('doctors').insert(insertData).select().single();

      if (error) throw error;

      const { password_hash: _, ...doctorData } = data;
      res.status(201).json({ success: true, message: 'Doctor registered successfully', data: doctorData });
    } catch (error) {
      next(error);
    }
  },

  // Doctor login
  login: async (req, res, next) => {
    try {
      const { email_address, password } = req.body;
      if (!email_address || !password) return res.status(400).json({ error: 'Email and password required' });

      const { data: doctor, error } = await supabase.from('doctors').select('*').eq('email_address', email_address).single();
      if (error || !doctor) return res.status(401).json({ error: 'Invalid email or password' });

      const isPasswordValid = await bcrypt.compare(password, doctor.password_hash || '');
      if (!isPasswordValid) return res.status(401).json({ error: 'Invalid email or password' });
      if (!doctor.is_active) return res.status(403).json({ error: 'Account inactive' });

      const { password_hash: _, ...doctorData } = doctor;

      // Generate JWT token (using same auth middleware) - include doctor role
      const { generateToken } = require('../middleware/auth');
      const token = generateToken({
        ...doctor,
        role: 'doctor' // Set role as doctor
      });

      // Include role in response data
      const responseData = {
        ...doctorData,
        role: 'doctor'
      };

      res.json({
        success: true,
        message: 'Login successful',
        token: token,
        data: responseData
      });
    } catch (error) {
      next(error);
    }
  },

  // Update doctor
  update: async (req, res, next) => {
    try {
      const { id } = req.params;
      const {
        full_name,
        phone_number,
        specialization,
        qualifications,
        bio,
        years_of_experience,
        consultation_fee,
        profile_image_url,
        is_active,
        is_verified,
        mental_health_specialties
      } = req.body;

      // Validate mental_health_specialties if provided (should be an array)
      if (mental_health_specialties !== undefined && !Array.isArray(mental_health_specialties)) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'mental_health_specialties must be an array (e.g., ["Anxiety", "Depression"])'
        });
      }

      const updateData = {};
      if (full_name !== undefined) updateData.full_name = full_name;
      if (phone_number !== undefined) updateData.phone_number = phone_number;
      if (specialization !== undefined) updateData.specialization = specialization;
      if (qualifications !== undefined) updateData.qualifications = qualifications;
      if (bio !== undefined) updateData.bio = bio;
      if (years_of_experience !== undefined) updateData.years_of_experience = years_of_experience;
      if (consultation_fee !== undefined) updateData.consultation_fee = consultation_fee;
      if (profile_image_url !== undefined) updateData.profile_image_url = profile_image_url;
      if (is_active !== undefined) updateData.is_active = is_active;
      if (is_verified !== undefined) updateData.is_verified = is_verified;
      if (mental_health_specialties !== undefined) updateData.mental_health_specialties = mental_health_specialties;

      const { data, error } = await supabase.from('doctors').update(updateData).eq('id', id).select().single();
      if (error) return res.status(404).json({ error: 'Doctor not found' });

      const { password_hash, ...doctor } = data;
      res.json({ message: 'Doctor updated successfully', data: doctor });
    } catch (error) {
      next(error);
    }
  },

  // Delete doctor
  delete: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { data, error } = await supabase.from('doctors').delete().eq('id', id).select().single();
      if (error) return res.status(500).json({ error: 'Failed to delete doctor' });
      res.json({ message: 'Doctor deleted successfully', data });
    } catch (error) {
      next(error);
    }
  },

  // Book appointment
  bookAppointment: async (req, res) => {
    try {
      const { userId, doctorName, consultationType, date, time } = req.body;
      if (!userId || !doctorName || !consultationType || !date || !time) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const { data: doctor, error: doctorError } = await supabase.from('doctors').select('id, full_name').eq('full_name', doctorName).single();
      if (doctorError || !doctor) return res.status(404).json({ message: "Doctor not found" });

      const { data, error } = await supabase.rpc("book_appointment", {
        p_user_id: userId,
        p_doctor_name: doctor.full_name,
        p_consultation_type: consultationType,
        p_appointment_date: date,
        p_appointment_time: time,
      });

      if (error) return res.status(500).json({ message: "Failed to book appointment", error });

      res.status(201).json({ message: "Appointment booked successfully", appointment: data });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Internal server error" });
    }
  }
};

module.exports = doctorController;
