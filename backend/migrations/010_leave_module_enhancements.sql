-- Create leave_types table for configurable leave settings
CREATE TABLE IF NOT EXISTS leave_types (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    clinic_id uuid REFERENCES clinics(id) ON DELETE CASCADE,
    name text NOT NULL, -- Annual, Sick, etc.
    annual_entitlement integer DEFAULT 21,
    color text DEFAULT '#3b82f6', -- default blue-500
    created_at timestamptz DEFAULT now(),
    UNIQUE(clinic_id, name)
);

-- Enhance leave_requests table
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS units_requested float; -- Store calculated units (days/shifts)
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES users(id);
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

-- Seed default leave types for existing clinics (optional, can be done via app logic or separate script, doing simple insert for now if empty)
-- This part is tricky in pure SQL without procedural language if we want to iterate all clinics. 
-- We'll assume the app will handle seeding or we rely on defaults in code fallbacks for now.
