-- =============================================================================
-- NextGen Facade AI — Apply manufacturer registry (migrations 014–019)
-- Paste into Supabase Dashboard → SQL Editor → Run
-- Idempotent: safe to re-run.
-- =============================================================================


-- >>> BEGIN 014_manufacturers_registry.sql
-- =============================================================================
-- NextGen Facade AI — Manufacturer Registry
-- Migration: 014_manufacturers_registry.sql
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.manufacturers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  brand TEXT,
  category TEXT NOT NULL,
  website TEXT NOT NULL,
  logo TEXT,
  country TEXT,
  headquarters TEXT,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  auto_import BOOLEAN NOT NULL DEFAULT true,
  import_frequency TEXT NOT NULL DEFAULT 'monthly'
    CHECK (import_frequency IN ('monthly', 'weekly', 'daily')),
  import_strategy TEXT NOT NULL DEFAULT 'generic',
  last_imported_at TIMESTAMPTZ,
  next_import_at TIMESTAMPTZ,
  total_products INTEGER NOT NULL DEFAULT 0,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS manufacturers_import_queue_idx
  ON public.manufacturers (enabled, auto_import, import_frequency, category, name);

CREATE INDEX IF NOT EXISTS manufacturers_slug_idx
  ON public.manufacturers (slug);

GRANT SELECT, INSERT, UPDATE ON TABLE public.manufacturers TO anon, authenticated;

ALTER TABLE public.manufacturers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "manufacturers_select_anon" ON public.manufacturers;
DROP POLICY IF EXISTS "manufacturers_insert_anon" ON public.manufacturers;
DROP POLICY IF EXISTS "manufacturers_update_anon" ON public.manufacturers;
DROP POLICY IF EXISTS "manufacturers_select_authenticated" ON public.manufacturers;
DROP POLICY IF EXISTS "manufacturers_insert_authenticated" ON public.manufacturers;
DROP POLICY IF EXISTS "manufacturers_update_authenticated" ON public.manufacturers;

CREATE POLICY "manufacturers_select_anon"
  ON public.manufacturers FOR SELECT TO anon USING (true);

CREATE POLICY "manufacturers_insert_anon"
  ON public.manufacturers FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "manufacturers_update_anon"
  ON public.manufacturers FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "manufacturers_select_authenticated"
  ON public.manufacturers FOR SELECT TO authenticated USING (true);

CREATE POLICY "manufacturers_insert_authenticated"
  ON public.manufacturers FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "manufacturers_update_authenticated"
  ON public.manufacturers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Seed manufacturer registry (idempotent).
INSERT INTO public.manufacturers (
  name, brand, category, website, import_strategy, slug, enabled, auto_import, import_frequency
) VALUES
  -- ACP Sheet
  ('Alucobond', 'ALUCOBOND', 'ACP Sheet', 'https://www.alucobond.com/en/products/', 'alucobond', 'alucobond', true, true, 'monthly'),
  ('ALPOLIC', 'ALPOLIC', 'ACP Sheet', 'https://www.alpolic.com/alpolic-intl/', 'mitsubishi-chemical', 'alpolic', true, true, 'monthly'),
  ('Reynobond', NULL, 'ACP Sheet', 'https://www.reynobond.com/products/', 'generic', 'reynobond', true, true, 'monthly'),
  ('Viva ACP', NULL, 'ACP Sheet', 'https://www.vivaacp.com/', 'generic', 'viva-acp', true, true, 'monthly'),
  ('Aludecor', NULL, 'ACP Sheet', 'https://www.aludecor.com/', 'generic', 'aludecor', true, true, 'monthly'),
  ('Alstrong', NULL, 'ACP Sheet', 'https://www.alstrong.in/', 'generic', 'alstrong', true, true, 'monthly'),
  ('Alstone', NULL, 'ACP Sheet', 'https://www.alstonegroup.com/', 'generic', 'alstone', true, true, 'monthly'),
  ('Eurobond', NULL, 'ACP Sheet', 'https://www.eurobondacp.com/', 'generic', 'eurobond', true, true, 'monthly'),
  ('Larson', NULL, 'ACP Sheet', 'https://www.larsonenvelope.com/', 'generic', 'larson', true, true, 'monthly'),
  ('Alubond', NULL, 'ACP Sheet', 'https://www.alubond.com/', 'generic', 'alubond', true, true, 'monthly'),

  -- Glass
  ('Guardian Glass', NULL, 'Glass', 'https://www.guardianglass.com', 'guardian-glass', 'guardian-glass', true, true, 'monthly'),
  ('AGC Glass', NULL, 'Glass', 'https://www.agc-yourglass.com', 'agc-glass', 'agc-glass', true, true, 'monthly'),
  ('Saint-Gobain Glass', NULL, 'Glass', 'https://www.saint-gobain-glass.com/en-gb/glass-products', 'saint-gobain', 'saint-gobain-glass', true, true, 'monthly'),
  ('Pilkington', NULL, 'Glass', 'https://www.pilkington.com', 'generic', 'pilkington', true, true, 'monthly'),
  ('Vitro', NULL, 'Glass', 'https://www.vitro.com', 'generic', 'vitro', true, true, 'monthly'),
  ('Schott', NULL, 'Glass', 'https://www.schott.com/en-us/architecture', 'generic', 'schott', true, true, 'monthly'),
  ('Sisecam', NULL, 'Glass', 'https://www.sisecam.com/en', 'generic', 'sisecam', true, true, 'monthly'),

  -- Stone
  ('Cosentino', NULL, 'Stone', 'https://www.cosentino.com', 'generic', 'cosentino', true, true, 'monthly'),
  ('Levantina', NULL, 'Stone', 'https://www.levantina.com', 'generic', 'levantina', true, true, 'monthly'),
  ('Antolini', NULL, 'Stone', 'https://www.antolini.com', 'generic', 'antolini', true, true, 'monthly'),

  -- HPL
  ('Trespa', NULL, 'HPL', 'https://www.trespa.com', 'generic', 'trespa', true, true, 'monthly'),
  ('Fundermax', NULL, 'HPL', 'https://www.fundermax.biz', 'generic', 'fundermax', true, true, 'monthly'),
  ('Greenlam', NULL, 'HPL', 'https://www.greenlamindustries.com', 'generic', 'greenlam', true, true, 'monthly'),
  ('Merino', NULL, 'HPL', 'https://www.merino.co.in', 'generic', 'merino', true, true, 'monthly'),

  -- Louvers
  ('Hunter Douglas', NULL, 'Louvers', 'https://www.hunterdouglasarchitectural.com', 'generic', 'hunter-douglas', true, true, 'monthly'),
  ('Renson', NULL, 'Louvers', 'https://www.renson.eu', 'generic', 'renson', true, true, 'monthly'),

  -- Metal
  ('Zahner', NULL, 'Metal', 'https://www.azahner.com', 'generic', 'zahner', true, true, 'monthly'),
  ('Lindner', NULL, 'Metal', 'https://www.lindner-group.com', 'generic', 'lindner', true, true, 'monthly')
ON CONFLICT (name) DO UPDATE SET
  brand = EXCLUDED.brand,
  category = EXCLUDED.category,
  website = EXCLUDED.website,
  import_strategy = EXCLUDED.import_strategy,
  slug = EXCLUDED.slug,
  enabled = EXCLUDED.enabled,
  auto_import = EXCLUDED.auto_import,
  import_frequency = EXCLUDED.import_frequency,
  updated_at = NOW();

-- <<< END 014_manufacturers_registry.sql


-- >>> BEGIN 015_manufacturers_registry_v2.sql
-- =============================================================================
-- NextGen Facade AI — Manufacturer Registry v2
-- Migration: 015_manufacturers_registry_v2.sql
-- =============================================================================

-- Align column names with registry spec (logo_url, last_status).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'manufacturers'
      AND column_name = 'logo'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'manufacturers'
      AND column_name = 'logo_url'
  ) THEN
    ALTER TABLE public.manufacturers RENAME COLUMN logo TO logo_url;
  END IF;
END $$;

ALTER TABLE public.manufacturers
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS last_status TEXT;

-- Link products to registry rows (additive — keeps manufacturer text for compat).
ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS manufacturer_id UUID REFERENCES public.manufacturers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS materials_manufacturer_id_idx
  ON public.materials (manufacturer_id);

-- Backfill manufacturer_id from existing manufacturer text.
UPDATE public.materials m
SET manufacturer_id = r.id
FROM public.manufacturers r
WHERE m.manufacturer_id IS NULL
  AND (
    lower(trim(m.manufacturer)) = lower(trim(r.name))
    OR (
      r.brand IS NOT NULL
      AND lower(trim(m.manufacturer)) = lower(trim(r.brand))
    )
  );

-- Seed additional manufacturers (idempotent).
INSERT INTO public.manufacturers (
  name, brand, category, website, import_strategy, slug, enabled, auto_import, import_frequency
) VALUES
  ('Cardinal Glass', NULL, 'Glass', 'https://www.cardinalcorp.com', 'generic', 'cardinal-glass', true, true, 'monthly'),
  ('Xinyi Glass', NULL, 'Glass', 'https://www.xinyiglass.com', 'generic', 'xinyi-glass', true, true, 'monthly'),
  ('Taiwan Glass', NULL, 'Glass', 'https://www.taiwanglass.com', 'generic', 'taiwan-glass', true, true, 'monthly'),
  ('Classic Marble', NULL, 'Stone', 'https://www.classicmarblecompany.com', 'generic', 'classic-marble', true, true, 'monthly'),
  ('RK Marble', NULL, 'Stone', 'https://www.rkmarbles.com', 'generic', 'rk-marble', true, true, 'monthly'),
  ('Abet Laminati', NULL, 'HPL', 'https://www.abetlaminati.com', 'generic', 'abet-laminati', true, true, 'monthly'),
  ('Levolux', NULL, 'Louvers', 'https://www.levolux.com', 'generic', 'levolux', true, true, 'monthly'),
  ('VMZINC', NULL, 'Metal', 'https://www.vmzinc.com', 'generic', 'vmzinc', true, true, 'monthly'),
  ('Kalzip', NULL, 'Metal', 'https://www.kalzip.com', 'generic', 'kalzip', true, true, 'monthly')
ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category,
  website = EXCLUDED.website,
  import_strategy = EXCLUDED.import_strategy,
  slug = EXCLUDED.slug,
  enabled = EXCLUDED.enabled,
  auto_import = EXCLUDED.auto_import,
  import_frequency = EXCLUDED.import_frequency,
  updated_at = NOW();

-- Re-run backfill for newly seeded manufacturers.
UPDATE public.materials m
SET manufacturer_id = r.id
FROM public.manufacturers r
WHERE m.manufacturer_id IS NULL
  AND (
    lower(trim(m.manufacturer)) = lower(trim(r.name))
    OR (
      r.brand IS NOT NULL
      AND lower(trim(m.manufacturer)) = lower(trim(r.brand))
    )
  );

-- <<< END 015_manufacturers_registry_v2.sql


-- >>> BEGIN 016_manufacturer_registry_create_defaults.sql
-- =============================================================================
-- NextGen Facade AI — Manufacturer Registry create defaults
-- Migration: 016_manufacturer_registry_create_defaults.sql
-- =============================================================================

-- Ensure new registry rows default into the monthly automatic import queue.
ALTER TABLE public.manufacturers
  ALTER COLUMN enabled SET DEFAULT true,
  ALTER COLUMN auto_import SET DEFAULT true,
  ALTER COLUMN import_frequency SET DEFAULT 'monthly',
  ALTER COLUMN import_strategy SET DEFAULT 'generic',
  ALTER COLUMN total_products SET DEFAULT 0;

-- Backfill next_import_at for enabled auto-import rows missing a schedule.
UPDATE public.manufacturers
SET next_import_at = (
  CASE
    WHEN EXTRACT(DAY FROM NOW() AT TIME ZONE 'UTC') < 1
      OR (
        EXTRACT(DAY FROM NOW() AT TIME ZONE 'UTC') = 1
        AND EXTRACT(HOUR FROM NOW() AT TIME ZONE 'UTC') < 2
      )
    THEN date_trunc('month', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 day' + INTERVAL '2 hours'
    ELSE date_trunc('month', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 month' + INTERVAL '1 day' + INTERVAL '2 hours'
  END
)
WHERE next_import_at IS NULL
  AND enabled = true
  AND auto_import = true
  AND import_frequency = 'monthly';

-- <<< END 016_manufacturer_registry_create_defaults.sql


-- >>> BEGIN 017_manufacturer_identity_aliases.sql
-- =============================================================================
-- NextGen Facade AI — Manufacturer identity, aliases, and deduplication
-- Migration: 017_manufacturer_identity_aliases.sql
-- =============================================================================

ALTER TABLE public.manufacturers
  ADD COLUMN IF NOT EXISTS aliases TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS website_host TEXT;

-- Populate website_host from existing website URLs.
UPDATE public.manufacturers
SET website_host = lower(
  regexp_replace(
    regexp_replace(
      regexp_replace(trim(website), '^https?://', '', 'i'),
      '^www\.', '', 'i'
    ),
    '/.*$', ''
  )
)
WHERE website_host IS NULL OR website_host = '';

CREATE UNIQUE INDEX IF NOT EXISTS manufacturers_website_host_unique_idx
  ON public.manufacturers (website_host)
  WHERE website_host IS NOT NULL AND website_host <> '';

CREATE INDEX IF NOT EXISTS manufacturers_aliases_gin_idx
  ON public.manufacturers USING gin (aliases);

-- Canonical manufacturer + brand separation with aliases.
UPDATE public.manufacturers
SET
  name = '3A Composites',
  brand = 'ALUCOBOND',
  aliases = ARRAY['Alucobond', 'ALUCOBOND'],
  updated_at = NOW()
WHERE slug = 'alucobond';

UPDATE public.manufacturers
SET
  name = 'Mitsubishi Chemical',
  brand = 'ALPOLIC',
  aliases = ARRAY['ALPOLIC', 'Mitsubishi Chemical Composites'],
  updated_at = NOW()
WHERE slug = 'alpolic';

UPDATE public.manufacturers
SET
  name = 'Saint-Gobain',
  aliases = ARRAY['Saint-Gobain Glass', 'Saint-Gobain Glass UK'],
  updated_at = NOW()
WHERE slug = 'saint-gobain-glass';

-- Re-link products using aliases and brand labels.
UPDATE public.materials m
SET manufacturer_id = r.id
FROM public.manufacturers r
WHERE m.manufacturer_id IS NULL
  AND (
    lower(trim(m.manufacturer)) = lower(trim(r.name))
    OR (
      r.brand IS NOT NULL
      AND lower(trim(m.manufacturer)) = lower(trim(r.brand))
    )
    OR EXISTS (
      SELECT 1
      FROM unnest(r.aliases) AS alias
      WHERE lower(trim(m.manufacturer)) = lower(trim(alias))
    )
  );

-- Normalize stored manufacturer text to registry company name when linked.
UPDATE public.materials m
SET manufacturer = r.name
FROM public.manufacturers r
WHERE m.manufacturer_id = r.id
  AND lower(trim(m.manufacturer)) <> lower(trim(r.name));

-- <<< END 017_manufacturer_identity_aliases.sql


-- >>> BEGIN 018_manufacturer_aliases_table.sql
-- =============================================================================
-- NextGen Facade AI — Manufacturer aliases table & normalization
-- Migration: 018_manufacturer_aliases_table.sql
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.manufacturer_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer_id UUID NOT NULL REFERENCES public.manufacturers(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT manufacturer_aliases_alias_unique UNIQUE (alias),
  CONSTRAINT manufacturer_aliases_pair_unique UNIQUE (manufacturer_id, alias)
);

CREATE INDEX IF NOT EXISTS manufacturer_aliases_manufacturer_id_idx
  ON public.manufacturer_aliases (manufacturer_id);

CREATE INDEX IF NOT EXISTS manufacturer_aliases_alias_lower_idx
  ON public.manufacturer_aliases (lower(alias));

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.manufacturer_aliases TO anon, authenticated;

ALTER TABLE public.manufacturer_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "manufacturer_aliases_select_anon" ON public.manufacturer_aliases;
DROP POLICY IF EXISTS "manufacturer_aliases_insert_anon" ON public.manufacturer_aliases;
DROP POLICY IF EXISTS "manufacturer_aliases_update_anon" ON public.manufacturer_aliases;
DROP POLICY IF EXISTS "manufacturer_aliases_delete_anon" ON public.manufacturer_aliases;
DROP POLICY IF EXISTS "manufacturer_aliases_select_authenticated" ON public.manufacturer_aliases;
DROP POLICY IF EXISTS "manufacturer_aliases_insert_authenticated" ON public.manufacturer_aliases;
DROP POLICY IF EXISTS "manufacturer_aliases_update_authenticated" ON public.manufacturer_aliases;
DROP POLICY IF EXISTS "manufacturer_aliases_delete_authenticated" ON public.manufacturer_aliases;

CREATE POLICY "manufacturer_aliases_select_anon"
  ON public.manufacturer_aliases FOR SELECT TO anon USING (true);

CREATE POLICY "manufacturer_aliases_insert_anon"
  ON public.manufacturer_aliases FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "manufacturer_aliases_update_anon"
  ON public.manufacturer_aliases FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "manufacturer_aliases_delete_anon"
  ON public.manufacturer_aliases FOR DELETE TO anon USING (true);

CREATE POLICY "manufacturer_aliases_select_authenticated"
  ON public.manufacturer_aliases FOR SELECT TO authenticated USING (true);

CREATE POLICY "manufacturer_aliases_insert_authenticated"
  ON public.manufacturer_aliases FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "manufacturer_aliases_update_authenticated"
  ON public.manufacturer_aliases FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "manufacturer_aliases_delete_authenticated"
  ON public.manufacturer_aliases FOR DELETE TO authenticated USING (true);

-- Canonical manufacturer names (single identity per company).
UPDATE public.manufacturers
SET name = 'Saint-Gobain Glass', updated_at = NOW()
WHERE slug = 'saint-gobain-glass';

UPDATE public.manufacturers
SET name = '3A Composites', brand = 'ALUCOBOND', updated_at = NOW()
WHERE slug = 'alucobond';

UPDATE public.manufacturers
SET name = 'Mitsubishi Chemical', brand = 'ALPOLIC', updated_at = NOW()
WHERE slug = 'alpolic';

-- Migrate legacy array aliases into manufacturer_aliases.
INSERT INTO public.manufacturer_aliases (manufacturer_id, alias)
SELECT m.id, trim(alias_value)
FROM public.manufacturers m
CROSS JOIN LATERAL unnest(m.aliases) AS alias_value
WHERE trim(alias_value) <> ''
  AND lower(trim(alias_value)) <> lower(trim(m.name))
ON CONFLICT (alias) DO NOTHING;

-- Seed standard normalization aliases.
INSERT INTO public.manufacturer_aliases (manufacturer_id, alias)
SELECT m.id, seed.alias
FROM public.manufacturers m
JOIN (
  VALUES
    ('saint-gobain-glass', 'Saint-Gobain'),
    ('saint-gobain-glass', 'Saint-Gobain Glass UK'),
    ('guardian-glass', 'Guardian'),
    ('agc-glass', 'AGC'),
    ('pilkington', 'Pilkington NSG'),
    ('alucobond', '3A'),
    ('alucobond', 'Alucobond'),
    ('alucobond', 'ALUCOBOND'),
    ('alpolic', 'Mitsubishi'),
    ('alpolic', 'ALPOLIC')
) AS seed(slug, alias) ON seed.slug = m.slug
WHERE lower(trim(seed.alias)) <> lower(trim(m.name))
ON CONFLICT (alias) DO NOTHING;

-- Keep manufacturers.aliases array in sync for backward compatibility.
UPDATE public.manufacturers m
SET aliases = COALESCE((
  SELECT array_agg(a.alias ORDER BY a.alias)
  FROM public.manufacturer_aliases a
  WHERE a.manufacturer_id = m.id
), '{}'::TEXT[]),
updated_at = NOW();

-- Link existing products via alias table.
UPDATE public.materials mat
SET
  manufacturer_id = a.manufacturer_id,
  manufacturer = r.name
FROM public.manufacturer_aliases a
JOIN public.manufacturers r ON r.id = a.manufacturer_id
WHERE lower(trim(mat.manufacturer)) = lower(trim(a.alias))
  AND (mat.manufacturer_id IS DISTINCT FROM a.manufacturer_id
    OR lower(trim(mat.manufacturer)) <> lower(trim(r.name)));

-- Link products by canonical manufacturer name.
UPDATE public.materials mat
SET
  manufacturer_id = r.id,
  manufacturer = r.name
FROM public.manufacturers r
WHERE mat.manufacturer_id IS NULL
  AND lower(trim(mat.manufacturer)) = lower(trim(r.name));

-- Link products by brand label where applicable.
UPDATE public.materials mat
SET
  manufacturer_id = r.id,
  manufacturer = r.name
FROM public.manufacturers r
WHERE mat.manufacturer_id IS NULL
  AND r.brand IS NOT NULL
  AND lower(trim(mat.manufacturer)) = lower(trim(r.brand));

-- <<< END 018_manufacturer_aliases_table.sql


-- >>> BEGIN 019_material_manufacturer_identity_backfill.sql
-- =============================================================================
-- NextGen Facade AI — Material manufacturer identity backfill
-- Migration: 019_material_manufacturer_identity_backfill.sql
-- Ensures every material row uses canonical manufacturer_id + canonical name.
-- =============================================================================

-- Link materials via manufacturer_aliases (alias text → canonical identity).
UPDATE public.materials mat
SET
  manufacturer_id = a.manufacturer_id,
  manufacturer = r.name,
  updated_at = NOW()
FROM public.manufacturer_aliases a
JOIN public.manufacturers r ON r.id = a.manufacturer_id
WHERE lower(trim(mat.manufacturer)) = lower(trim(a.alias))
  AND (mat.manufacturer_id IS DISTINCT FROM a.manufacturer_id
    OR lower(trim(mat.manufacturer)) <> lower(trim(r.name)));

-- Link materials by canonical manufacturer name.
UPDATE public.materials mat
SET
  manufacturer_id = r.id,
  manufacturer = r.name,
  updated_at = NOW()
FROM public.manufacturers r
WHERE mat.manufacturer_id IS NULL
  AND lower(trim(mat.manufacturer)) = lower(trim(r.name));

-- Link materials by brand label where the brand is registered on the manufacturer.
UPDATE public.materials mat
SET
  manufacturer_id = r.id,
  manufacturer = r.name,
  updated_at = NOW()
FROM public.manufacturers r
WHERE mat.manufacturer_id IS NULL
  AND r.brand IS NOT NULL
  AND lower(trim(mat.manufacturer)) = lower(trim(r.brand));

-- Link materials by legacy manufacturers.aliases array (pre-table fallback).
UPDATE public.materials mat
SET
  manufacturer_id = r.id,
  manufacturer = r.name,
  updated_at = NOW()
FROM public.manufacturers r
WHERE mat.manufacturer_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM unnest(r.aliases) AS alias
    WHERE lower(trim(mat.manufacturer)) = lower(trim(alias))
  );

-- Normalize any rows already linked but still storing alias text.
UPDATE public.materials mat
SET
  manufacturer = r.name,
  updated_at = NOW()
FROM public.manufacturers r
WHERE mat.manufacturer_id = r.id
  AND lower(trim(mat.manufacturer)) <> lower(trim(r.name));

CREATE INDEX IF NOT EXISTS materials_manufacturer_id_idx
  ON public.materials (manufacturer_id)
  WHERE manufacturer_id IS NOT NULL;

-- <<< END 019_material_manufacturer_identity_backfill.sql


-- Refresh denormalized product counts after identity backfill.
UPDATE public.manufacturers m
SET total_products = COALESCE(c.cnt, 0),
    updated_at = NOW()
FROM (
  SELECT manufacturer_id AS id, COUNT(*)::INTEGER AS cnt
  FROM public.materials
  WHERE manufacturer_id IS NOT NULL
  GROUP BY manufacturer_id
) c
WHERE m.id = c.id;

UPDATE public.manufacturers
SET total_products = 0,
    updated_at = NOW()
WHERE id NOT IN (
  SELECT DISTINCT manufacturer_id
  FROM public.materials
  WHERE manufacturer_id IS NOT NULL
)
AND total_products <> 0;

-- Report coverage.
SELECT
  COUNT(*)::INTEGER AS total_manufacturers,
  COUNT(*) FILTER (WHERE total_products > 0)::INTEGER AS with_products,
  COUNT(*) FILTER (WHERE total_products = 0)::INTEGER AS without_products
FROM public.manufacturers;
