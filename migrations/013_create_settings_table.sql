-- Create settings table for user/clinic settings
CREATE TABLE IF NOT EXISTS settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- NULL for global settings
  setting_category VARCHAR(50) NOT NULL, -- 'clinic_info', 'appointment_booking', 'patient_records', 'environment_support'
  setting_key VARCHAR(100) NOT NULL,
  setting_value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, setting_category, setting_key)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_settings_user_id ON settings(user_id);
CREATE INDEX IF NOT EXISTS idx_settings_category ON settings(setting_category);
CREATE INDEX IF NOT EXISTS idx_settings_user_category ON settings(user_id, setting_category);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE settings IS 'User and clinic settings';
COMMENT ON COLUMN settings.setting_category IS 'Category: clinic_info, appointment_booking, patient_records, environment_support';
COMMENT ON COLUMN settings.setting_value IS 'Setting value in JSON format';

