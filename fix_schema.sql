-- SQL to fix missing columns in templates and banners tables

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Ensure whatsapp_templates table exists
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

-- Ensure thermal_print_templates table exists
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

-- Add missing columns to whatsapp_templates table
ALTER TABLE whatsapp_templates ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE whatsapp_templates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add missing columns to thermal_print_templates table
ALTER TABLE thermal_print_templates ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE thermal_print_templates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add missing columns to banners table
ALTER TABLE banners ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE banners ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Ensure id columns have defaults for auto-generation
ALTER TABLE whatsapp_templates ALTER COLUMN id SET DEFAULT uuid_generate_v4();
ALTER TABLE thermal_print_templates ALTER COLUMN id SET DEFAULT uuid_generate_v4();
ALTER TABLE banners ALTER COLUMN id SET DEFAULT uuid_generate_v4();

-- Ensure search paths are correct for future queries
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_tenant ON whatsapp_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_thermal_templates_tenant ON thermal_print_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_banners_tenant_order ON banners(tenant_id, sort_order);
