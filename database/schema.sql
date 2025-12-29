-- =========================================
-- HURE CORE DATABASE SCHEMA
-- Run this in your Supabase SQL Editor
-- =========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================
-- 1. CLINICS (Organizations/Tenants)
-- =========================================
CREATE TABLE clinics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    contact_name VARCHAR(255),
    
    -- Verification
    org_verification_status VARCHAR(50) DEFAULT 'pending', -- pending, under_review, approved, rejected
    org_rejection_notes TEXT,
    kra_pin VARCHAR(100),
    business_reg_no VARCHAR(100),
    
    -- Subscription
    plan_key VARCHAR(50) DEFAULT 'essential', -- essential, professional, enterprise
    plan_status VARCHAR(50) DEFAULT 'active',
    plan_expires_at TIMESTAMPTZ,
    
    -- Status
    status VARCHAR(50) DEFAULT 'pending_verification', -- pending_verification, active, suspended
    email_verified BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================
-- 2. CLINIC LOCATIONS
-- =========================================
CREATE TABLE clinic_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    city VARCHAR(100),
    address TEXT,
    phone VARCHAR(50),
    
    -- Facility Verification
    facility_verification_status VARCHAR(50) DEFAULT 'draft', -- draft, pending_review, approved, rejected
    facility_rejection_notes TEXT,
    license_no VARCHAR(100),
    licensing_body VARCHAR(100),
    license_expiry DATE,
    license_document_url TEXT,
    
    is_primary BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================
-- 3. USERS (All user types)
-- =========================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    location_id UUID REFERENCES clinic_locations(id),
    
    email VARCHAR(255) NOT NULL,
    username VARCHAR(100),
    password_hash TEXT,
    
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(50),
    
    role VARCHAR(50) NOT NULL DEFAULT 'staff', -- owner, admin, manager, staff
    account_type VARCHAR(50) DEFAULT 'staff', -- owner, staff
    
    -- Staff-specific fields
    job_title VARCHAR(100),
    pay_type VARCHAR(50), -- monthly, daily, hourly
    pay_rate DECIMAL(12, 2),
    hire_date DATE,
    
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(email, clinic_id)
);

-- =========================================
-- 4. ROLES & PERMISSIONS
-- =========================================
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    permissions JSONB DEFAULT '[]',
    is_elevated BOOLEAN DEFAULT FALSE, -- consumes admin seat
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, role_id)
);

-- =========================================
-- 5. SCHEDULE
-- =========================================
CREATE TABLE schedule_blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES clinic_locations(id) ON DELETE CASCADE,
    
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    role_required VARCHAR(100),
    headcount_required INTEGER DEFAULT 1,
    
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE schedule_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    schedule_block_id UUID NOT NULL REFERENCES schedule_blocks(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- External coverage (non-employee)
    is_external BOOLEAN DEFAULT FALSE,
    external_name VARCHAR(255),
    external_phone VARCHAR(50),
    external_notes TEXT,
    
    status VARCHAR(50) DEFAULT 'assigned', -- assigned, confirmed, completed
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================
-- 6. ATTENDANCE
-- =========================================
CREATE TABLE attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES clinic_locations(id),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    date DATE NOT NULL,
    clock_in TIMESTAMPTZ,
    clock_out TIMESTAMPTZ,
    
    status VARCHAR(50), -- present_full, present_partial, absent, late, no_clockout
    total_hours DECIMAL(5, 2),
    
    is_reviewed BOOLEAN DEFAULT FALSE,
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, date)
);

-- =========================================
-- 7. LEAVE REQUESTS
-- =========================================
CREATE TABLE leave_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    leave_type VARCHAR(50) NOT NULL, -- annual, sick, personal, maternity, unpaid
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    
    status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    rejection_notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================
-- 8. DOCUMENTS
-- =========================================
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    location_id UUID REFERENCES clinic_locations(id),
    user_id UUID REFERENCES users(id),
    
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100), -- license, contract, policy, other
    file_url TEXT NOT NULL,
    file_size INTEGER,
    
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================
-- 9. OTP CODES (Email verification)
-- =========================================
CREATE TABLE otp_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    code VARCHAR(10) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================
-- 10. AUDIT LOG
-- =========================================
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID REFERENCES clinics(id),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id UUID,
    details JSONB,
    ip_address VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================
-- 11. EXTERNAL COVERAGE (for Payroll)
-- =========================================
CREATE TABLE external_coverage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES clinic_locations(id),
    schedule_block_id UUID REFERENCES schedule_blocks(id),
    
    date DATE NOT NULL,
    role VARCHAR(100),
    external_name VARCHAR(255) NOT NULL,
    external_phone VARCHAR(50),
    supervisor VARCHAR(255),
    notes TEXT,
    
    -- Payroll fields
    units DECIMAL(5, 2) DEFAULT 1, -- 1 = Full, 0.5 = Half
    agreed_pay DECIMAL(12, 2),
    payroll_status VARCHAR(50) DEFAULT 'draft', -- draft, submitted, approved, paid
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================
-- INDEXES
-- =========================================
CREATE INDEX idx_users_clinic ON users(clinic_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_location ON users(location_id);
CREATE INDEX idx_locations_clinic ON clinic_locations(clinic_id);
CREATE INDEX idx_attendance_user_date ON attendance(user_id, date);
CREATE INDEX idx_attendance_clinic_date ON attendance(clinic_id, date);
CREATE INDEX idx_schedule_location_date ON schedule_blocks(location_id, date);
CREATE INDEX idx_schedule_clinic_date ON schedule_blocks(clinic_id, date);
CREATE INDEX idx_leave_user ON leave_requests(user_id);
CREATE INDEX idx_leave_clinic ON leave_requests(clinic_id);
CREATE INDEX idx_audit_clinic ON audit_log(clinic_id);
CREATE INDEX idx_otp_email ON otp_codes(email);

-- =========================================
-- ROW LEVEL SECURITY (Basic)
-- =========================================

ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- =========================================
-- SEED: Create SuperAdmin user (optional)
-- =========================================

-- INSERT INTO users (email, username, password_hash, role, account_type, first_name, last_name, clinic_id)
-- VALUES (
--     'admin@hure.app',
--     'superadmin',
--     '$2b$10$...', -- Replace with bcrypt hash of your password
--     'superadmin',
--     'owner',
--     'Super',
--     'Admin',
--     NULL -- SuperAdmin has no clinic
-- );
