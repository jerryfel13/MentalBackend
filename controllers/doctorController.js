const { supabase } = require('../config/supabase');
const bcrypt = require('bcrypt');

const doctorController = {
  // Get all doctors
  getAll: async (req, res, next) => {
    try {
      const { specialization, is_active, is_verified } = req.query;

      let query = supabase
        .from('doctors')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply filters
      if (specialization) {
        query = query.ilike('specialization', `%${specialization}%`);
      }

      if (is_active !== undefined) {
        query = query.eq('is_active', is_active === 'true');
      }

      if (is_verified !== undefined) {
        query = query.eq('is_verified', is_verified === 'true');
      }

      const { data, error } = await query;

      if (error) {
        error.status = 500;
        throw error;
      }

      // Remove password_hash from response
      const doctors = (data || []).map(({ password_hash, ...doctor }) => doctor);

      res.json({
        message: 'Doctors retrieved successfully',
        count: doctors.length,
        data: doctors
      });
    } catch (error) {
      next(error);
    }
  },

  // Get available doctors (active and verified)
  getAvailable: async (req, res, next) => {
    try {
      const { specialization } = req.query;

      let query = supabase
        .from('doctors')
        .select('*')
        .eq('is_active', true)
        .eq('is_verified', true)
        .order('full_name', { ascending: true });

      // Apply specialization filter if provided
      if (specialization) {
        query = query.ilike('specialization', `%${specialization}%`);
      }

      const { data, error } = await query;

      if (error) {
        error.status = 500;
        throw error;
      }

      // Remove password_hash from response
      const doctors = (data || []).map(({ password_hash, ...doctor }) => doctor);

      res.json({
        message: 'Available doctors retrieved successfully',
        count: doctors.length,
        data: doctors
      });
    } catch (error) {
      next(error);
    }
  },

  // Get doctor by ID
  getById: async (req, res, next) => {
    try {
      const { id } = req.params;

      const { data, error } = await supabase
        .from('doctors')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({
            error: 'Doctor not found',
            message: `No doctor found with ID: ${id}`
          });
        }
        error.status = 500;
        throw error;
      }

      // Remove password_hash from response
      const { password_hash, ...doctor } = data;

      res.json({
        message: 'Doctor retrieved successfully',
        data: doctor
      });
    } catch (error) {
      next(error);
    }
  },

  // Register new doctor
  register: async (req, res, next) => {
    try {
      const {
        full_name,
        email_address,
        password,
        phone_number,
        specialization,
        license_number,
        qualifications,
        bio,
        years_of_experience,
        consultation_fee,
        profile_image_url
      } = req.body;

      // Validate required fields
      if (!full_name || !email_address || !password || !specialization || !license_number) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'full_name, email_address, password, specialization, and license_number are required',
          required_fields: ['full_name', 'email_address', 'password', 'specialization', 'license_number']
        });
      }

      // Validate password length
      if (password.length < 8) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Password must be at least 8 characters long'
        });
      }

      // Check if email already exists
      const { data: existingDoctor } = await supabase
        .from('doctors')
        .select('email_address')
        .eq('email_address', email_address)
        .single();

      if (existingDoctor) {
        return res.status(409).json({
          error: 'Registration Failed',
          message: 'A doctor with this email address already exists'
        });
      }

      // Check if license number already exists
      const { data: existingLicense } = await supabase
        .from('doctors')
        .select('license_number')
        .eq('license_number', license_number)
        .single();

      if (existingLicense) {
        return res.status(409).json({
          error: 'Registration Failed',
          message: 'A doctor with this license number already exists'
        });
      }

      // Hash password
      const saltRounds = 10;
      const password_hash = await bcrypt.hash(password, saltRounds);

      // Create new doctor
      const { data, error } = await supabase
        .from('doctors')
        .insert({
          full_name,
          email_address,
          password_hash,
          phone_number,
          specialization,
          license_number,
          qualifications,
          bio,
          years_of_experience,
          consultation_fee,
          profile_image_url,
          is_active: true,
          is_verified: false // New doctors need admin verification
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return res.status(409).json({
            error: 'Registration Failed',
            message: 'A doctor with this email or license number already exists'
          });
        }
        error.status = 500;
        throw error;
      }

      // Remove password_hash from response
      const { password_hash: _, ...doctorData } = data;

      res.status(201).json({
        success: true,
        message: 'Doctor registered successfully',
        data: doctorData
      });
    } catch (error) {
      next(error);
    }
  },

  // Login doctor
  login: async (req, res, next) => {
    try {
      const { email_address, password } = req.body;

      // Validate required fields
      if (!email_address || !password) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'email_address and password are required'
        });
      }

      // Find doctor by email
      const { data: doctor, error: fetchError } = await supabase
        .from('doctors')
        .select('*')
        .eq('email_address', email_address)
        .single();

      if (fetchError || !doctor) {
        return res.status(401).json({
          error: 'Authentication Failed',
          message: 'Invalid email or password'
        });
      }

      // Check if doctor has a password
      if (!doctor.password_hash) {
        return res.status(401).json({
          error: 'Authentication Failed',
          message: 'Please reset your password or contact support'
        });
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, doctor.password_hash);

      if (!isPasswordValid) {
        return res.status(401).json({
          error: 'Authentication Failed',
          message: 'Invalid email or password'
        });
      }

      // Check if doctor is active
      if (!doctor.is_active) {
        return res.status(403).json({
          error: 'Account Inactive',
          message: 'Your account has been deactivated. Please contact support.'
        });
      }

      // Remove password_hash from response
      const { password_hash: _, ...doctorData } = doctor;

      // Generate JWT token (using same auth middleware)
      const { generateToken } = require('../middleware/auth');
      const token = generateToken(doctor);

      res.json({
        success: true,
        message: 'Login successful',
        token: token,
        data: doctorData
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
        is_active
      } = req.body;

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

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'No fields to update'
        });
      }

      const { data, error } = await supabase
        .from('doctors')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({
            error: 'Doctor not found',
            message: `No doctor found with ID: ${id}`
          });
        }
        error.status = 500;
        throw error;
      }

      // Remove password_hash from response
      const { password_hash, ...doctor } = data;

      res.json({
        message: 'Doctor updated successfully',
        data: doctor
      });
    } catch (error) {
      next(error);
    }
  },

  // Delete doctor
  delete: async (req, res, next) => {
    try {
      const { id } = req.params;

      const { data, error } = await supabase
        .from('doctors')
        .delete()
        .eq('id', id)
        .select()
        .single();

      if (error) {
        error.status = 500;
        throw error;
      }

      if (!data) {
        return res.status(404).json({
          error: 'Doctor not found',
          message: `No doctor found with ID: ${id}`
        });
      }

      res.json({
        message: 'Doctor deleted successfully',
        data: data
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = doctorController;

