-- Migration: Add invite columns to users table
-- Run this in your Supabase SQL Editor

-- Add invite token and status columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_status VARCHAR(50) DEFAULT 'pending';

-- Create index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_users_invite_token ON users(invite_token);

-- Optional: Add column comments
COMMENT ON COLUMN users.invite_token IS 'Token for employee self-signup invite link';
COMMENT ON COLUMN users.invite_status IS 'Invite status: pending, accepted, expired';
