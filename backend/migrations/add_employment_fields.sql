-- Migration: Add employment_type and pay_rate columns to users table
-- Run this in Supabase SQL Editor

-- Add employment_type column (enum-like text field)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS employment_type TEXT DEFAULT 'full-time';

-- Add pay_rate column (decimal for salary/daily rate)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS pay_rate DECIMAL(10, 2);

-- Optional: Add a comment describing the values
COMMENT ON COLUMN users.employment_type IS 'Employment type: full-time, part-time, casual, contract';
COMMENT ON COLUMN users.pay_rate IS 'Pay rate in KES (daily rate for casual, monthly for full-time)';
