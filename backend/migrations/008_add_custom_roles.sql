ALTER TABLE clinics ADD COLUMN IF NOT EXISTS custom_roles jsonb DEFAULT '[]';
