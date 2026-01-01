-- Add profile fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS dob date;

-- Emergency Contact
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_name text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_phone text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_relationship text;

-- Address
ALTER TABLE users ADD COLUMN IF NOT EXISTS country text DEFAULT 'Kenya';
ALTER TABLE users ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS area text;

-- Audit
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_profile_update timestamptz;
