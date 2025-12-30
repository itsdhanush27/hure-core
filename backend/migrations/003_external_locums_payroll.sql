-- External Locums & Payroll Pipeline Migration
-- Run this in Supabase SQL Editor

-- ============================================
-- EXTERNAL LOCUMS TABLE
-- Stores external/agency staff assigned to shifts
-- NOT part of users table (never counts toward staff limits)
-- ============================================
CREATE TABLE IF NOT EXISTS external_locums (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    schedule_block_id UUID NOT NULL REFERENCES schedule_blocks(id) ON DELETE CASCADE,
    
    -- Locum details
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    role VARCHAR(100), -- Inherited from shift or custom
    daily_rate DECIMAL(10, 2) NOT NULL DEFAULT 0,
    
    -- Optional tracking
    supervisor_id UUID REFERENCES users(id), -- Internal staff supervising
    notes TEXT, -- Agency name, agreed pay, remarks
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX idx_external_locums_clinic ON external_locums(clinic_id);
CREATE INDEX idx_external_locums_schedule ON external_locums(schedule_block_id);

-- ============================================
-- ATTENDANCE TABLE UPDATES
-- Add support for external locum attendance
-- ============================================

-- Add columns for locum attendance (if not exists)
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS external_locum_id UUID REFERENCES external_locums(id);
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS attendance_type VARCHAR(20) DEFAULT 'clock_in'; -- 'clock_in' | 'confirmation'
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS locum_status VARCHAR(20); -- 'WORKED' | 'NO_SHOW' (for locums only)
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS hours_override DECIMAL(4, 2); -- Manual hours override

-- ============================================
-- PAYROLL RECORDS TABLE
-- Track payment status per employee/locum per period
-- ============================================
CREATE TABLE IF NOT EXISTS payroll_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    
    -- Period
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- Employee or Locum (one of these)
    user_id UUID REFERENCES users(id),
    external_locum_id UUID REFERENCES external_locums(id),
    
    -- Calculations
    pay_type VARCHAR(20) NOT NULL, -- 'salaried' | 'daily' | 'locum'
    units_worked DECIMAL(5, 2) DEFAULT 0, -- Full day = 1.0, Partial = 0.5
    rate DECIMAL(10, 2) DEFAULT 0, -- Monthly salary or daily rate
    gross_pay DECIMAL(10, 2) DEFAULT 0,
    
    -- Payment status
    payment_status VARCHAR(20) DEFAULT 'UNPAID', -- 'UNPAID' | 'PAID'
    paid_at TIMESTAMPTZ,
    paid_by UUID REFERENCES users(id),
    payment_note TEXT, -- 'M-Pesa', 'Cash', 'Via agency', etc.
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT chk_employee_or_locum CHECK (
        (user_id IS NOT NULL AND external_locum_id IS NULL) OR
        (user_id IS NULL AND external_locum_id IS NOT NULL)
    )
);

-- Indexes
CREATE INDEX idx_payroll_clinic ON payroll_records(clinic_id);
CREATE INDEX idx_payroll_period ON payroll_records(period_start, period_end);
CREATE INDEX idx_payroll_user ON payroll_records(user_id);
CREATE INDEX idx_payroll_locum ON payroll_records(external_locum_id);
CREATE INDEX idx_payroll_status ON payroll_records(payment_status);

-- ============================================
-- RLS POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE external_locums ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_records ENABLE ROW LEVEL SECURITY;

-- external_locums policies
CREATE POLICY "Users can view locums in their clinic" ON external_locums
    FOR SELECT USING (clinic_id IN (
        SELECT clinic_id FROM users WHERE id = auth.uid()
    ));

CREATE POLICY "Users can manage locums in their clinic" ON external_locums
    FOR ALL USING (clinic_id IN (
        SELECT clinic_id FROM users WHERE id = auth.uid()
    ));

-- payroll_records policies
CREATE POLICY "Users can view payroll in their clinic" ON payroll_records
    FOR SELECT USING (clinic_id IN (
        SELECT clinic_id FROM users WHERE id = auth.uid()
    ));

CREATE POLICY "Users can manage payroll in their clinic" ON payroll_records
    FOR ALL USING (clinic_id IN (
        SELECT clinic_id FROM users WHERE id = auth.uid()
    ));

-- ============================================
-- GRANT SERVICE ROLE ACCESS
-- ============================================
GRANT ALL ON external_locums TO service_role;
GRANT ALL ON payroll_records TO service_role;
