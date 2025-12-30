-- Migration: Add system_role and status columns to users table
-- This separates Job Title (display) from System Role (access level)

-- Add system_role column (OWNER/ADMIN/EMPLOYEE)
ALTER TABLE users ADD COLUMN IF NOT EXISTS system_role TEXT DEFAULT 'EMPLOYEE';

-- Add status column for staff lifecycle (invited/active/inactive/archived)
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Set existing owners to OWNER system_role and active status
UPDATE users 
SET system_role = 'OWNER', status = 'active'
WHERE role = 'Owner';

-- Set existing managers to ADMIN
UPDATE users 
SET system_role = 'ADMIN'
WHERE role IN ('Shift Manager', 'HR Manager', 'Payroll Officer') 
  AND (system_role IS NULL OR system_role = 'EMPLOYEE');

-- Ensure all other staff are EMPLOYEE
UPDATE users 
SET system_role = 'EMPLOYEE'
WHERE system_role IS NULL;
