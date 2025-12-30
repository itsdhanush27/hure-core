-- Migration: Add organization document fields and verification metadata
-- Date: 2025-12-30
-- Description: Add document URLs, expiry dates, and verification workflow fields to clinics table

-- Add document storage fields
ALTER TABLE clinics
ADD COLUMN IF NOT EXISTS business_reg_doc TEXT,
ADD COLUMN IF NOT EXISTS facility_license_doc TEXT,
ADD COLUMN IF NOT EXISTS business_reg_expiry DATE,
ADD COLUMN IF NOT EXISTS facility_license_expiry DATE;

-- Add verification workflow fields
ALTER TABLE clinics
ADD COLUMN IF NOT EXISTS verification_rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS verification_submitted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS verification_reviewed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS verification_reviewed_by UUID REFERENCES users(id);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_clinics_verification_status ON clinics(org_verification_status);
CREATE INDEX IF NOT EXISTS idx_clinics_license_expiry ON clinics(facility_license_expiry) WHERE facility_license_expiry IS NOT NULL;

COMMENT ON COLUMN clinics.business_reg_doc IS 'URL to uploaded business registration document in Supabase Storage';
COMMENT ON COLUMN clinics.facility_license_doc IS 'URL to uploaded facility license document in Supabase Storage';
COMMENT ON COLUMN clinics.business_reg_expiry IS 'Expiry date for business registration';
COMMENT ON COLUMN clinics.facility_license_expiry IS 'Expiry date for facility operating license';
COMMENT ON COLUMN clinics.verification_rejection_reason IS 'Admin provided reason if verification was rejected';
COMMENT ON COLUMN clinics.verification_submitted_at IS 'Timestamp when organization submitted for verification';
COMMENT ON COLUMN clinics.verification_reviewed_at IS 'Timestamp when admin reviewed the submission';
COMMENT ON COLUMN clinics.verification_reviewed_by IS 'User ID of admin who reviewed';
