-- Fix: Allow user_id to be NULL in attendance when external_locum_id is set
-- Run this in Supabase SQL Editor

-- First, drop the NOT NULL constraint on user_id (if exists)
ALTER TABLE attendance ALTER COLUMN user_id DROP NOT NULL;

-- Add a check constraint to ensure either user_id OR external_locum_id is present
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS chk_attendance_user_or_locum;
ALTER TABLE attendance ADD CONSTRAINT chk_attendance_user_or_locum 
    CHECK (user_id IS NOT NULL OR external_locum_id IS NOT NULL);
