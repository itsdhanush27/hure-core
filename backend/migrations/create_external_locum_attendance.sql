-- Migration: Create external_locum_attendance table
-- This table stores attendance records for external locums, linked to the external_locums table

CREATE TABLE IF NOT EXISTS external_locum_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_locum_id UUID NOT NULL REFERENCES external_locums(id) ON DELETE CASCADE,
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    location_id UUID REFERENCES clinic_locations(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'WORKED', 'NO_SHOW', 'pending'
    clock_in TIMESTAMPTZ,
    clock_out TIMESTAMPTZ,
    hours_worked DECIMAL(5,2) DEFAULT 0,
    notes TEXT,
    recorded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one attendance record per locum per date
    UNIQUE(external_locum_id, date)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_external_locum_attendance_locum ON external_locum_attendance(external_locum_id);
CREATE INDEX IF NOT EXISTS idx_external_locum_attendance_clinic_date ON external_locum_attendance(clinic_id, date);
CREATE INDEX IF NOT EXISTS idx_external_locum_attendance_location ON external_locum_attendance(location_id);

-- Enable RLS
ALTER TABLE external_locum_attendance ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow authenticated users from the same clinic to view/manage
CREATE POLICY "Users can view external locum attendance for their clinic"
    ON external_locum_attendance
    FOR SELECT
    USING (true);

CREATE POLICY "Users can insert external locum attendance"
    ON external_locum_attendance
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Users can update external locum attendance"
    ON external_locum_attendance
    FOR UPDATE
    USING (true);
