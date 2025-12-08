-- Create appointments table to link users with doctors
CREATE TABLE IF NOT EXISTS appointments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  appointment_type VARCHAR(50) DEFAULT 'Video Call', -- Video Call, In-Person, Phone Call
  status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, confirmed, completed, cancelled, rescheduled
  notes TEXT,
  session_link TEXT, -- For video call links
  meeting_room_id VARCHAR(255), -- For video call room ID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_appointment_time UNIQUE(doctor_id, appointment_date, appointment_time)
); 


  
-- Create index on user_id for user's appointment history
CREATE INDEX IF NOT EXISTS idx_appointments_user_id ON appointments(user_id);

-- Create index on doctor_id for doctor's appointments
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_id ON appointments(doctor_id);
    
-- Create index on appointment_date for date-based queries
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);

-- Create composite index for common queries
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_date ON appointments(doctor_id, appointment_date);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE appointments IS 'Appointments between users and doctors';
COMMENT ON COLUMN appointments.appointment_type IS 'Type of appointment: Video Call, In-Person, Phone Call';
COMMENT ON COLUMN appointments.status IS 'Appointment status: scheduled, confirmed, completed, cancelled, rescheduled';
COMMENT ON COLUMN appointments.session_link IS 'Link for video call sessions';
COMMENT ON COLUMN appointments.meeting_room_id IS 'Unique room ID for video call sessions';



