-- =============================================
-- PROMOS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS promos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    discount_percent INTEGER NOT NULL CHECK (discount_percent >= 1 AND discount_percent <= 100),
    description TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    max_uses INTEGER,
    uses_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX idx_promos_code ON promos(code);
CREATE INDEX idx_promos_is_active ON promos(is_active);

-- RLS Policy (optional - restrict to authenticated users)
ALTER TABLE promos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for service role" ON promos
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- =============================================
-- SITE CONTENT TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS site_content (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX idx_site_content_key ON site_content(key);

-- RLS Policy
ALTER TABLE site_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for service role" ON site_content
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Insert default content
INSERT INTO site_content (key, value) VALUES
    ('hero_title', 'Streamline Your Workforce Operations'),
    ('hero_subtitle', 'Complete staff management solution for your organization. Schedule, attendance, payroll, and compliance — all in one place.'),
    ('pricing_essential', '8000'),
    ('pricing_professional', '15000'),
    ('pricing_enterprise', '25000')
ON CONFLICT (key) DO NOTHING;
