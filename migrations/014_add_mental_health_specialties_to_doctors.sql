-- Add mental_health_specialties field to doctors table
-- This field stores an array of specific mental health issues/problems the doctor specializes in
ALTER TABLE doctors 
ADD COLUMN IF NOT EXISTS mental_health_specialties JSONB DEFAULT '[]'::jsonb;

-- Create index for efficient querying of mental health specialties
CREATE INDEX IF NOT EXISTS idx_doctors_mental_health_specialties 
ON doctors USING GIN (mental_health_specialties);

-- Add comment to explain the field
COMMENT ON COLUMN doctors.mental_health_specialties IS 'Array of specific mental health issues/problems the doctor specializes in (e.g., ["Anxiety", "Depression", "PTSD", "Bipolar Disorder", "OCD", "Eating Disorders", "Substance Abuse", "Trauma", "Grief and Loss", "Relationship Issues", "Stress Management", "ADHD", "Autism Spectrum", "Schizophrenia", "Personality Disorders"])';

