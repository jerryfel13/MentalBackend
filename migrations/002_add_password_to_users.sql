-- Add password column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

-- Add comment to the column
COMMENT ON COLUMN users.password_hash IS 'Hashed password for user authentication';


