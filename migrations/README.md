# Database Migrations

This directory contains SQL migration files for setting up the database schema in Supabase.

## Migration Files

1. `001_create_users_table.sql` - Creates the users table
2. `002_add_password_to_users.sql` - Adds password authentication to users
3. `003_create_doctors_table.sql` - Creates the doctors table
4. `004_create_doctor_schedules_table.sql` - Creates doctor schedules/availability table
5. `005_create_appointments_table.sql` - Creates appointments table linking users and doctors
... (additional migrations)
14. `014_add_mental_health_specialties_to_doctors.sql` - Adds mental health specialties field to doctors table

## Running Migrations

### Option 1: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard: https://supabase.com/dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy and paste the contents of each migration file **in order** (001, 002, 003, etc.)
5. Click **Run** to execute each migration

**Important:** Run migrations in numerical order!

### Option 2: Using Supabase CLI

If you have Supabase CLI installed:

```bash
supabase db push
```

## Table Structures

### Users Table (`001_create_users_table.sql`)

- **id** (UUID, Primary Key) - Auto-generated unique identifier
- **full_name** (VARCHAR) - User's full name (required)
- **date_of_birth** (DATE) - Date of birth (required)
- **age** (INTEGER) - Age
- **gender** (VARCHAR) - Gender
- **civil_status** (VARCHAR) - Civil status (e.g., Single, Married, Divorced)
- **address** (TEXT) - Full address
- **contact_number** (VARCHAR) - Contact phone number
- **email_address** (VARCHAR) - Email address (required, unique)
- **emergency_contact_person_number** (TEXT) - Emergency contact information
- **created_at** (TIMESTAMP) - Auto-generated creation timestamp
- **updated_at** (TIMESTAMP) - Auto-updated modification timestamp

### Doctors Table (`003_create_doctors_table.sql`)

- **id** (UUID, Primary Key) - Auto-generated unique identifier
- **full_name** (VARCHAR) - Doctor's full name (required)
- **email_address** (VARCHAR) - Email address (required, unique)
- **password_hash** (VARCHAR) - Hashed password for authentication
- **phone_number** (VARCHAR) - Contact phone number
- **specialization** (VARCHAR) - Medical specialty (required)
- **license_number** (VARCHAR) - Medical license number (unique)
- **qualifications** (TEXT) - Educational qualifications and certifications
- **bio** (TEXT) - Professional biography
- **years_of_experience** (INTEGER) - Years of experience
- **consultation_fee** (DECIMAL) - Fee per consultation
- **profile_image_url** (TEXT) - Profile image URL
- **is_active** (BOOLEAN) - Whether accepting new patients (default: true)
- **is_verified** (BOOLEAN) - Whether credentials verified (default: false)
- **mental_health_specialties** (JSONB) - Array of specific mental health issues/problems the doctor specializes in (e.g., ["Anxiety", "Depression", "PTSD"]) - Added in migration 014
- **created_at** (TIMESTAMP) - Auto-generated creation timestamp
- **updated_at** (TIMESTAMP) - Auto-updated modification timestamp

### Doctor Schedules Table (`004_create_doctor_schedules_table.sql`)

- **id** (UUID, Primary Key) - Auto-generated unique identifier
- **doctor_id** (UUID) - Foreign key to doctors table
- **day_of_week** (INTEGER) - Day of week (0=Sunday, 6=Saturday)
- **start_time** (TIME) - Start time of availability
- **end_time** (TIME) - End time of availability
- **is_available** (BOOLEAN) - Whether available on this schedule (default: true)
- **created_at** (TIMESTAMP) - Auto-generated creation timestamp
- **updated_at** (TIMESTAMP) - Auto-updated modification timestamp

### Appointments Table (`005_create_appointments_table.sql`)

- **id** (UUID, Primary Key) - Auto-generated unique identifier
- **user_id** (UUID) - Foreign key to users table
- **doctor_id** (UUID) - Foreign key to doctors table
- **appointment_date** (DATE) - Date of appointment (required)
- **appointment_time** (TIME) - Time of appointment (required)
- **duration_minutes** (INTEGER) - Duration in minutes (default: 60)
- **appointment_type** (VARCHAR) - Type: Video Call, In-Person, Phone Call (default: 'Video Call')
- **status** (VARCHAR) - Status: scheduled, confirmed, completed, cancelled, rescheduled (default: 'scheduled')
- **notes** (TEXT) - Appointment notes
- **session_link** (TEXT) - Link for video call sessions
- **meeting_room_id** (VARCHAR) - Room ID for video calls
- **created_at** (TIMESTAMP) - Auto-generated creation timestamp
- **updated_at** (TIMESTAMP) - Auto-updated modification timestamp

## Features

- Automatic UUID generation for primary keys
- Unique constraints on email addresses and license numbers
- Indexes on frequently queried columns for performance
- Automatic timestamp management (created_at and updated_at)
- Foreign key constraints for data integrity
- Cascade deletes for related records

