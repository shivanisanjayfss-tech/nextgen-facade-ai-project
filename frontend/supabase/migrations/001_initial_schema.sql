-- =============================================================================
-- NextGen Facade AI — Complete Supabase Migration
-- Paste this entire script into Supabase Dashboard → SQL Editor → Run
-- =============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ─────────────────────────────────────────────────────────────────────────────
-- Clean slate (safe for first run; comment out if you have existing data)
-- ─────────────────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS datasheets CASCADE;
DROP TABLE IF EXISTS knowledge_articles CASCADE;
DROP TABLE IF EXISTS materials CASCADE;

DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper: auto-update updated_at
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. MATERIALS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE materials (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  slug          TEXT        NOT NULL UNIQUE,
  category      TEXT        NOT NULL CHECK (category IN (
                  'ACP Sheet', 'Glass', 'Stone', 'HPL', 'Louvers', 'Metal', 'Composite', 'Other'
                )),
  manufacturer  TEXT        NOT NULL,
  description   TEXT        NOT NULL DEFAULT '',
  specs         JSONB       NOT NULL DEFAULT '{}',
  image_url     TEXT,
  datasheet_url TEXT,
  tags          TEXT[]      NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX materials_category_idx       ON materials (category);
CREATE INDEX materials_manufacturer_idx   ON materials (manufacturer);
CREATE INDEX materials_slug_idx           ON materials (slug);
CREATE INDEX materials_created_at_idx     ON materials (created_at DESC);
CREATE INDEX materials_name_trgm_idx      ON materials USING gin (name gin_trgm_ops);
CREATE INDEX materials_tags_idx           ON materials USING gin (tags);
CREATE INDEX materials_specs_gin_idx      ON materials USING gin (specs);

CREATE TRIGGER materials_set_updated_at
  BEFORE UPDATE ON materials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS disabled for now
ALTER TABLE materials DISABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. DATASHEETS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE datasheets (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id  UUID        NOT NULL REFERENCES materials (id) ON DELETE CASCADE,
  title        TEXT        NOT NULL,
  manufacturer TEXT        NOT NULL,
  category     TEXT        NOT NULL,
  file_url     TEXT        NOT NULL,
  file_size    TEXT,
  version      TEXT,
  pages        INTEGER,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX datasheets_material_id_idx   ON datasheets (material_id);
CREATE INDEX datasheets_category_idx      ON datasheets (category);
CREATE INDEX datasheets_published_at_idx  ON datasheets (published_at DESC);

CREATE TRIGGER datasheets_set_updated_at
  BEFORE UPDATE ON datasheets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE datasheets DISABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. KNOWLEDGE_ARTICLES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE knowledge_articles (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              TEXT        NOT NULL UNIQUE,
  title             TEXT        NOT NULL,
  excerpt           TEXT        NOT NULL DEFAULT '',
  content           TEXT        NOT NULL DEFAULT '',
  category          TEXT        NOT NULL CHECK (category IN (
                      'Best Practices', 'Case Study', 'Technical Guide', 'Regulations', 'Design'
                    )),
  author            TEXT        NOT NULL DEFAULT 'NextGen Facade AI',
  read_time_minutes INTEGER     NOT NULL DEFAULT 5 CHECK (read_time_minutes > 0),
  tags              TEXT[]      NOT NULL DEFAULT '{}',
  published_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX knowledge_articles_slug_idx        ON knowledge_articles (slug);
CREATE INDEX knowledge_articles_category_idx    ON knowledge_articles (category);
CREATE INDEX knowledge_articles_published_at_idx ON knowledge_articles (published_at DESC);
CREATE INDEX knowledge_articles_tags_idx        ON knowledge_articles USING gin (tags);

CREATE TRIGGER knowledge_articles_set_updated_at
  BEFORE UPDATE ON knowledge_articles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE knowledge_articles DISABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- SEED: 10 facade materials (ACP Sheet, Glass, Stone, HPL + Louvers, Metal, Composite)
-- Fixed UUIDs so datasheets can reference them
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO materials (
  id, name, slug, category, manufacturer, description, specs, image_url, datasheet_url, tags
) VALUES

-- ACP Sheet
(
  '11111111-1111-4111-8111-111111111001',
  'Alucobond Plus A2',
  'alucobond-plus-a2',
  'ACP Sheet',
  '3A Composites',
  'Fire-retardant aluminium composite panel with mineral-filled core. A2-s1,d0 rated for high-rise facades.',
  '{
    "fireRating": "A2-s1, d0 (EN 13501-1)",
    "thermalConductivity": "0.35 W/m·K",
    "weight": "5.9 kg/m²",
    "thickness": "4 mm",
    "windLoad": "Up to 5.0 kPa",
    "uValue": "0.25 W/m²K",
    "colorOptions": ["Silver Metallic", "Anthracite", "Pure White"],
    "warranty": "20 years"
  }'::jsonb,
  NULL,
  '/datasheets/alucobond-plus-a2',
  ARRAY['fire-rated', 'high-rise', 'metallic']
),
(
  '11111111-1111-4111-8111-111111111002',
  'Alpolic FR',
  'alpolic-fr',
  'ACP Sheet',
  'Mitsubishi Chemical',
  'Fire-retardant ACP with luminescent core technology. Suitable for external cladding on buildings over 15m.',
  '{
    "fireRating": "A2-s1, d0 (EN 13501-1)",
    "thermalConductivity": "0.38 W/m·K",
    "weight": "6.1 kg/m²",
    "thickness": "4 mm",
    "windLoad": "Up to 4.8 kPa",
    "warranty": "15 years"
  }'::jsonb,
  NULL,
  NULL,
  ARRAY['fire-rated', 'ACP Sheet', 'japan']
),

-- Glass
(
  '22222222-2222-4222-8222-222222222001',
  'Guardian SunGuard SNX 60/28',
  'guardian-sunguard-snx-60-28',
  'Glass',
  'Guardian Glass',
  'Triple silver low-E coated glass with 60% VLT and 28% SHGC for high-performance curtain walls.',
  '{
    "fireRating": "Non-combustible",
    "thermalConductivity": "1.0 W/m·K",
    "weight": "25 kg/m² (6mm)",
    "thickness": "6–12 mm",
    "uValue": "1.1 W/m²K (IGU)",
    "colorOptions": ["Neutral", "Blue-Green Tint"],
    "warranty": "10 years coating"
  }'::jsonb,
  NULL,
  NULL,
  ARRAY['low-e', 'solar-control', 'curtain-wall']
),
(
  '22222222-2222-4222-8222-222222222002',
  'Pilkington Optitherm S1 Plus',
  'pilkington-optitherm-s1-plus',
  'Glass',
  'Pilkington',
  'Advanced thermal insulation glass with low-E coating for energy-efficient facade systems.',
  '{
    "fireRating": "Non-combustible",
    "thermalConductivity": "1.0 W/m·K",
    "weight": "20 kg/m² (6mm)",
    "thickness": "6–10 mm",
    "uValue": "0.9 W/m²K (IGU)",
    "warranty": "10 years"
  }'::jsonb,
  NULL,
  NULL,
  ARRAY['low-e', 'thermal', 'insulated-glazing']
),

-- Stone
(
  '33333333-3333-4333-8333-333333333001',
  'Neolith Iron Corten',
  'neolith-iron-corten',
  'Stone',
  'Neolith',
  'Sintered stone with authentic corten steel aesthetic. UV-stable for ventilated rainscreen facades.',
  '{
    "fireRating": "A1 (Non-combustible)",
    "thermalConductivity": "1.3 W/m·K",
    "weight": "30 kg/m² (12mm)",
    "thickness": "6–20 mm",
    "windLoad": "Up to 4.5 kPa",
    "warranty": "15 years"
  }'::jsonb,
  NULL,
  NULL,
  ARRAY['sintered-stone', 'rainscreen', 'corten-look']
),
(
  '33333333-3333-4333-8333-333333333002',
  'Caesarstone Raw Concrete',
  'caesarstone-raw-concrete',
  'Stone',
  'Caesarstone',
  'Engineered quartz surface with raw concrete finish for feature cladding and interior-exterior transitions.',
  '{
    "fireRating": "A2-s1, d0",
    "thermalConductivity": "1.5 W/m·K",
    "weight": "28 kg/m² (12mm)",
    "thickness": "12–20 mm",
    "warranty": "10 years"
  }'::jsonb,
  NULL,
  NULL,
  ARRAY['engineered-stone', 'concrete-look']
),

-- HPL
(
  '44444444-4444-4444-8444-444444444001',
  'Trespa Meteon FR',
  'trespa-meteon-fr',
  'HPL',
  'Trespa',
  'Fire-retardant high-pressure laminate with through-color technology for exterior cladding.',
  '{
    "fireRating": "B-s1, d0 (EN 13501-1)",
    "thermalConductivity": "0.15 W/m·K",
    "weight": "14 kg/m² (8mm)",
    "thickness": "6–13 mm",
    "windLoad": "Up to 3.5 kPa",
    "warranty": "10 years"
  }'::jsonb,
  NULL,
  NULL,
  ARRAY['hpl', 'fire-retardant', 'through-color']
),
(
  '44444444-4444-4444-8444-444444444002',
  'Fundermax Max Exterior',
  'fundermax-max-exterior',
  'HPL',
  'Fundermax',
  'Compact laminate facade panel with integrated surface and core color. High impact resistance.',
  '{
    "fireRating": "B-s1, d0 (EN 13501-1)",
    "thermalConductivity": "0.18 W/m·K",
    "weight": "16 kg/m² (10mm)",
    "thickness": "8–13 mm",
    "windLoad": "Up to 3.0 kPa",
    "warranty": "10 years"
  }'::jsonb,
  NULL,
  NULL,
  ARRAY['hpl', 'compact-laminate', 'exterior']
),

-- Louvers
(
  '55555555-5555-4555-8555-555555555001',
  'Hunter Douglas 84R Elliptical Louver',
  'hunter-douglas-84r-louver',
  'Louvers',
  'Hunter Douglas Architectural',
  'Extruded aluminium elliptical louver for solar shading. Fixed and motorized options available.',
  '{
    "fireRating": "A1 (Non-combustible)",
    "weight": "8 kg/m²",
    "thickness": "84 mm blade depth",
    "windLoad": "Up to 2.5 kPa",
    "warranty": "15 years"
  }'::jsonb,
  NULL,
  NULL,
  ARRAY['solar-shading', 'motorized', 'aluminium']
),

-- Metal
(
  '66666666-6666-4666-8666-666666666001',
  'Rheinzink Pre-Patina Standing Seam',
  'rheinzink-standing-seam',
  'Metal',
  'Rheinzink',
  'Titanium-zinc standing seam cladding with natural self-healing patina for premium envelopes.',
  '{
    "fireRating": "A1 (Non-combustible)",
    "thermalConductivity": "110 W/m·K",
    "weight": "7 kg/m² (0.7mm)",
    "thickness": "0.7–1.0 mm",
    "windLoad": "Up to 4.0 kPa",
    "warranty": "50 years material"
  }'::jsonb,
  NULL,
  NULL,
  ARRAY['zinc', 'standing-seam', 'natural-patina']
);

-- ─────────────────────────────────────────────────────────────────────────────
-- SEED: Sample datasheets (linked to materials)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO datasheets (material_id, title, manufacturer, category, file_url, file_size, version, pages)
VALUES
(
  '11111111-1111-4111-8111-111111111001',
  'Alucobond Plus A2 — Technical Datasheet',
  '3A Composites',
  'ACP Sheet',
  '/files/datasheets/alucobond-plus-a2.pdf',
  '2.4 MB',
  'Rev. 3.2',
  12
),
(
  '22222222-2222-4222-8222-222222222001',
  'Guardian SunGuard SNX 60/28 — Product Data',
  'Guardian Glass',
  'Glass',
  '/files/datasheets/guardian-snx-6028.pdf',
  '1.8 MB',
  'Rev. 2.1',
  8
),
(
  '44444444-4444-4444-8444-444444444001',
  'Trespa Meteon FR — Technical Manual',
  'Trespa',
  'HPL',
  '/files/datasheets/trespa-meteon-fr.pdf',
  '3.1 MB',
  'Rev. 4.0',
  24
);

-- ─────────────────────────────────────────────────────────────────────────────
-- SEED: Sample knowledge articles
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO knowledge_articles (slug, title, excerpt, content, category, read_time_minutes, tags)
VALUES
(
  'acp-fire-ratings-explained',
  'ACP Sheet Fire Ratings Explained: A1 vs A2 vs B',
  'Understanding EN 13501-1 classifications for aluminium composite panels.',
  'Aluminium composite panels are classified under EN 13501-1 based on reaction to fire. A1 panels are non-combustible with mineral cores. A2 panels are limited combustibility. B-rated panels have PE cores and are restricted on high-rise buildings in many jurisdictions.',
  'Technical Guide',
  8,
  ARRAY['ACP Sheet', 'fire-rating', 'regulations']
),
(
  'rainscreen-design-principles',
  'Rainscreen Design Principles for Modern Facades',
  'Best practices for ventilated rainscreen cavity sizing and weather barriers.',
  'A ventilated rainscreen facade consists of an outer cladding layer, ventilated cavity, insulation, and inner structure. The cavity allows moisture drainage and air circulation, improving durability and thermal performance.',
  'Best Practices',
  12,
  ARRAY['rainscreen', 'design', 'moisture']
),
(
  'uae-fire-code-facade-requirements',
  'UAE Fire Code: Facade Material Requirements',
  'External cladding requirements for buildings above 15m in the UAE.',
  'Buildings exceeding 15 meters in height in the UAE must use A2-s1,d0 or better rated external cladding. PE-core ACP panels are prohibited on new construction above this threshold.',
  'Regulations',
  6,
  ARRAY['regulations', 'UAE', 'fire-code']
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Done
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 'Migration complete' AS status,
       (SELECT COUNT(*) FROM materials)          AS materials_count,
       (SELECT COUNT(*) FROM datasheets)         AS datasheets_count,
       (SELECT COUNT(*) FROM knowledge_articles) AS articles_count;
