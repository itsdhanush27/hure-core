-- Migration: Add permissions column to users table
-- This allows storing custom permissions for staff with ADMIN system role

ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions jsonb DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN users.permissions IS 'Custom permissions array for ADMIN users, e.g. ["my_schedule", "team_schedule", "manage_staff"]';
