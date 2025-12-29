-- Migration: Add permission_role column to users table
-- Run this in Supabase SQL Editor

-- Add permission_role column (defaults to 'Staff' for all employees)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS permission_role TEXT DEFAULT 'Staff';

-- Update existing users who have elevated job_titles to have proper permission_role
UPDATE users 
SET permission_role = job_title 
WHERE job_title IN ('HR Manager', 'Shift Manager', 'Payroll Officer', 'Owner');

-- For users with job_title as actual jobs (Doctor, Nurse, etc.), ensure permission_role is Staff
UPDATE users 
SET permission_role = 'Staff' 
WHERE job_title NOT IN ('HR Manager', 'Shift Manager', 'Payroll Officer', 'Owner', 'Staff')
AND permission_role IS NULL;

COMMENT ON COLUMN users.permission_role IS 'Access level: Staff, HR Manager, Shift Manager, Payroll Officer, Owner';
