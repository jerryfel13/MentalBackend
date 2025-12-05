-- Create doctors table
CREATE TABLE IF NOT EXISTS doctors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  email_address VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  phone_number VARCHAR(20),
  specialization VARCHAR(255) NOT NULL,
  license_number VARCHAR(100) UNIQUE,
  qualifications TEXT,
  bio TEXT,
  years_of_experience INTEGER,
  consultation_fee DECIMAL(10, 2),
  profile_image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_doctors_email ON doctors(email_address);

-- Create index on specialization for filtering
CREATE INDEX IF NOT EXISTS idx_doctors_specialization ON doctors(specialization);

-- Create index on license number for verification
CREATE INDEX IF NOT EXISTS idx_doctors_license ON doctors(license_number);

-- Create index on active status
CREATE INDEX IF NOT EXISTS idx_doctors_active ON doctors(is_active);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_doctors_updated_at BEFORE UPDATE ON doctors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments to table and columns
COMMENT ON TABLE doctors IS 'Doctor information table with professional details, credentials, and availability';
COMMENT ON COLUMN doctors.full_name IS 'Full name of the doctor';
COMMENT ON COLUMN doctors.email_address IS 'Unique email address for login and communication';
COMMENT ON COLUMN doctors.password_hash IS 'Hashed password for doctor authentication';
COMMENT ON COLUMN doctors.specialization IS 'Medical specialty or area of expertise (e.g., Anxiety & Stress, Depression Support)';
COMMENT ON COLUMN doctors.license_number IS 'Medical license or registration number';
COMMENT ON COLUMN doctors.qualifications IS 'Educational qualifications and certifications';
COMMENT ON COLUMN doctors.bio IS 'Professional biography and background';
COMMENT ON COLUMN doctors.consultation_fee IS 'Fee per consultation session';
COMMENT ON COLUMN doctors.is_active IS 'Whether the doctor is currently accepting new patients';
COMMENT ON COLUMN doctors.is_verified IS 'Whether the doctor credentials have been verified by admin';

