-- Create user_documents table for compliance
CREATE TABLE IF NOT EXISTS user_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    
    type VARCHAR(50) NOT NULL, -- license, certificate, national_id, other 
    title VARCHAR(255),        -- e.g. "Nursing License", "ACLS Cert"
    document_number VARCHAR(100),
    expiry_date DATE,
    
    file_url TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, verified, rejected
    rejection_reason TEXT,
    
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Basic RLS (enable but open for authenticated users for now)
ALTER TABLE user_documents ENABLE ROW LEVEL SECURITY;

-- Index
CREATE INDEX IF NOT EXISTS idx_user_docs_user ON user_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_user_docs_clinic ON user_documents(clinic_id);
