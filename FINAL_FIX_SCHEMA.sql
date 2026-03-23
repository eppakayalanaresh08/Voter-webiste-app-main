-- SQL TO RE-SYNC CORE DATABASE COLUMNS FOR BANNERS AND TEMPLATES

-- 1. EXTENSIONS (REQUIRED FOR UUID DEFAULTS)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. FIX WHATSAPP TEMPLATES TABLE
CREATE TABLE IF NOT EXISTS whatsapp_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    body TEXT NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    image_url TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE whatsapp_templates ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE whatsapp_templates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE whatsapp_templates ALTER COLUMN id SET DEFAULT uuid_generate_v4();

-- 3. FIX THERMAL PRINT TEMPLATES TABLE
CREATE TABLE IF NOT EXISTS thermal_print_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    body TEXT NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    image_url TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE thermal_print_templates ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE thermal_print_templates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE thermal_print_templates ALTER COLUMN id SET DEFAULT uuid_generate_v4();

-- 4. FIX BANNERS TABLE
-- Check if banners table exists, create it correctly if missing
CREATE TABLE IF NOT EXISTS banners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    title TEXT,
    subtitle TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    image_url TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- In case table existed but was missing columns:
ALTER TABLE banners ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE banners ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE banners ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE banners ALTER COLUMN id SET DEFAULT uuid_generate_v4();

-- 5. REFRESH SCHEMA CACHE (IMPORTANT FOR POSTGREST/SUPABASE)
NOTIFY pgrst, 'reload schema';

-- 6. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_tenant ON whatsapp_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_thermal_templates_tenant ON thermal_print_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_banners_tenant_order ON banners(tenant_id, sort_order);
