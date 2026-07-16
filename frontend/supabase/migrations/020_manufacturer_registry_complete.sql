-- =============================================================================
-- NextGen Facade AI — Manufacturer Registry (complete bootstrap)
-- Migration: 020_manufacturer_registry_complete.sql
--
-- Creates manufacturers + manufacturer_aliases, seeds the planned registry,
-- adds materials.manufacturer_id, and backfills existing products.
-- Idempotent: safe to re-run.
-- =============================================================================

-- 1) Canonical manufacturer registry
CREATE TABLE IF NOT EXISTS public.manufacturers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE,
  brand TEXT,
  website TEXT NOT NULL,
  website_host TEXT,
  category TEXT NOT NULL,
  aliases TEXT[] NOT NULL DEFAULT '{}',
  logo_url TEXT,
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
  last_status TEXT,
  total_products INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Compatibility: older drafts used column name "logo"
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'manufacturers' AND column_name = 'logo'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'manufacturers' AND column_name = 'logo_url'
  ) THEN
    ALTER TABLE public.manufacturers RENAME COLUMN logo TO logo_url;
  END IF;
END $$;

ALTER TABLE public.manufacturers
  ADD COLUMN IF NOT EXISTS website_host TEXT,
  ADD COLUMN IF NOT EXISTS aliases TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS headquarters TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_import BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS import_frequency TEXT NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS import_strategy TEXT NOT NULL DEFAULT 'generic',
  ADD COLUMN IF NOT EXISTS last_imported_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_import_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_status TEXT,
  ADD COLUMN IF NOT EXISTS total_products INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS manufacturers_import_queue_idx
  ON public.manufacturers (enabled, auto_import, import_frequency, category, name);

CREATE INDEX IF NOT EXISTS manufacturers_slug_idx
  ON public.manufacturers (slug);

CREATE UNIQUE INDEX IF NOT EXISTS manufacturers_website_host_unique_idx
  ON public.manufacturers (website_host)
  WHERE website_host IS NOT NULL AND website_host <> '';

CREATE INDEX IF NOT EXISTS manufacturers_aliases_gin_idx
  ON public.manufacturers USING gin (aliases);

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

-- 2) Alias table for identity resolution
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

-- 3) Seed planned manufacturers (canonical company names)
INSERT INTO public.manufacturers (
  name, brand, category, website, website_host, import_strategy, slug,
  enabled, auto_import, import_frequency, aliases
) VALUES
  -- ACP Sheet
  ('3A Composites', 'ALUCOBOND', 'ACP Sheet', 'https://www.alucobond.com/en/products/', 'alucobond.com', 'alucobond', 'alucobond', true, true, 'monthly', ARRAY['Alucobond', 'ALUCOBOND', '3A']),
  ('Mitsubishi Chemical', 'ALPOLIC', 'ACP Sheet', 'https://www.alpolic.com/alpolic-intl/', 'alpolic.com', 'mitsubishi-chemical', 'alpolic', true, true, 'monthly', ARRAY['ALPOLIC', 'Mitsubishi', 'Mitsubishi Chemical Composites']),
  ('Reynobond', NULL, 'ACP Sheet', 'https://www.reynobond.com/products/', 'reynobond.com', 'generic', 'reynobond', true, true, 'monthly', '{}'),
  ('Viva ACP', NULL, 'ACP Sheet', 'https://www.vivaacp.com/', 'vivaacp.com', 'generic', 'viva-acp', true, true, 'monthly', '{}'),
  ('Aludecor', NULL, 'ACP Sheet', 'https://www.aludecor.com/', 'aludecor.com', 'generic', 'aludecor', true, true, 'monthly', '{}'),
  ('Alstrong', NULL, 'ACP Sheet', 'https://www.alstrong.in/', 'alstrong.in', 'generic', 'alstrong', true, true, 'monthly', '{}'),
  ('Alstone', NULL, 'ACP Sheet', 'https://www.alstonegroup.com/', 'alstonegroup.com', 'generic', 'alstone', true, true, 'monthly', '{}'),
  ('Eurobond', NULL, 'ACP Sheet', 'https://www.eurobondacp.com/', 'eurobondacp.com', 'generic', 'eurobond', true, true, 'monthly', '{}'),
  ('Larson', NULL, 'ACP Sheet', 'https://www.larsonenvelope.com/', 'larsonenvelope.com', 'generic', 'larson', true, true, 'monthly', '{}'),
  ('Alubond', NULL, 'ACP Sheet', 'https://www.alubond.com/', 'alubond.com', 'generic', 'alubond', true, true, 'monthly', '{}'),

  -- Glass
  ('Guardian Glass', NULL, 'Glass', 'https://www.guardianglass.com', 'guardianglass.com', 'guardian-glass', 'guardian-glass', true, true, 'monthly', ARRAY['Guardian']),
  ('AGC Glass', NULL, 'Glass', 'https://www.agc-yourglass.com', 'agc-yourglass.com', 'agc-glass', 'agc-glass', true, true, 'monthly', ARRAY['AGC']),
  ('Saint-Gobain Glass', NULL, 'Glass', 'https://www.saint-gobain-glass.com/en-gb/glass-products', 'saint-gobain-glass.com', 'saint-gobain', 'saint-gobain-glass', true, true, 'monthly', ARRAY['Saint-Gobain', 'Saint-Gobain Glass UK']),
  ('Pilkington', NULL, 'Glass', 'https://www.pilkington.com', 'pilkington.com', 'generic', 'pilkington', true, true, 'monthly', ARRAY['Pilkington NSG']),
  ('Vitro', NULL, 'Glass', 'https://www.vitro.com', 'vitro.com', 'generic', 'vitro', true, true, 'monthly', '{}'),
  ('Schott', NULL, 'Glass', 'https://www.schott.com/en-us/architecture', 'schott.com', 'generic', 'schott', true, true, 'monthly', '{}'),
  ('Sisecam', NULL, 'Glass', 'https://www.sisecam.com/en', 'sisecam.com', 'generic', 'sisecam', true, true, 'monthly', '{}'),
  ('Cardinal Glass', NULL, 'Glass', 'https://www.cardinalcorp.com', 'cardinalcorp.com', 'generic', 'cardinal-glass', true, true, 'monthly', '{}'),
  ('Xinyi Glass', NULL, 'Glass', 'https://www.xinyiglass.com', 'xinyiglass.com', 'generic', 'xinyi-glass', true, true, 'monthly', '{}'),
  ('Taiwan Glass', NULL, 'Glass', 'https://www.taiwanglass.com', 'taiwanglass.com', 'generic', 'taiwan-glass', true, true, 'monthly', '{}'),

  -- Stone
  ('Cosentino', NULL, 'Stone', 'https://www.cosentino.com', 'cosentino.com', 'generic', 'cosentino', true, true, 'monthly', '{}'),
  ('Levantina', NULL, 'Stone', 'https://www.levantina.com', 'levantina.com', 'generic', 'levantina', true, true, 'monthly', '{}'),
  ('Antolini', NULL, 'Stone', 'https://www.antolini.com', 'antolini.com', 'generic', 'antolini', true, true, 'monthly', '{}'),
  ('Classic Marble', NULL, 'Stone', 'https://www.classicmarblecompany.com', 'classicmarblecompany.com', 'generic', 'classic-marble', true, true, 'monthly', '{}'),
  ('RK Marble', NULL, 'Stone', 'https://www.rkmarbles.com', 'rkmarbles.com', 'generic', 'rk-marble', true, true, 'monthly', '{}'),
  ('Neolith', NULL, 'Stone', 'https://www.neolith.com', 'neolith.com', 'generic', 'neolith', true, true, 'monthly', '{}'),
  ('Caesarstone', NULL, 'Stone', 'https://www.caesarstone.com', 'caesarstone.com', 'generic', 'caesarstone', true, true, 'monthly', '{}'),

  -- HPL
  ('Trespa', NULL, 'HPL', 'https://www.trespa.com', 'trespa.com', 'generic', 'trespa', true, true, 'monthly', '{}'),
  ('Fundermax', NULL, 'HPL', 'https://www.fundermax.biz', 'fundermax.biz', 'generic', 'fundermax', true, true, 'monthly', '{}'),
  ('Greenlam', NULL, 'HPL', 'https://www.greenlamindustries.com', 'greenlamindustries.com', 'generic', 'greenlam', true, true, 'monthly', '{}'),
  ('Merino', NULL, 'HPL', 'https://www.merino.co.in', 'merino.co.in', 'generic', 'merino', true, true, 'monthly', '{}'),
  ('Abet Laminati', NULL, 'HPL', 'https://www.abetlaminati.com', 'abetlaminati.com', 'generic', 'abet-laminati', true, true, 'monthly', '{}'),

  -- Louvers
  ('Hunter Douglas', NULL, 'Louvers', 'https://www.hunterdouglasarchitectural.com', 'hunterdouglasarchitectural.com', 'generic', 'hunter-douglas', true, true, 'monthly', ARRAY['Hunter Douglas Architectural']),
  ('Renson', NULL, 'Louvers', 'https://www.renson.eu', 'renson.eu', 'generic', 'renson', true, true, 'monthly', '{}'),
  ('Levolux', NULL, 'Louvers', 'https://www.levolux.com', 'levolux.com', 'generic', 'levolux', true, true, 'monthly', '{}'),

  -- Metal
  ('Zahner', NULL, 'Metal', 'https://www.azahner.com', 'azahner.com', 'generic', 'zahner', true, true, 'monthly', '{}'),
  ('Lindner', NULL, 'Metal', 'https://www.lindner-group.com', 'lindner-group.com', 'generic', 'lindner', true, true, 'monthly', '{}'),
  ('VMZINC', NULL, 'Metal', 'https://www.vmzinc.com', 'vmzinc.com', 'generic', 'vmzinc', true, true, 'monthly', '{}'),
  ('Kalzip', NULL, 'Metal', 'https://www.kalzip.com', 'kalzip.com', 'generic', 'kalzip', true, true, 'monthly', '{}'),
  ('Rheinzink', NULL, 'Metal', 'https://www.rheinzink.com', 'rheinzink.com', 'generic', 'rheinzink', true, true, 'monthly', '{}')
ON CONFLICT (name) DO UPDATE SET
  brand = EXCLUDED.brand,
  category = EXCLUDED.category,
  website = EXCLUDED.website,
  website_host = EXCLUDED.website_host,
  import_strategy = EXCLUDED.import_strategy,
  slug = EXCLUDED.slug,
  enabled = EXCLUDED.enabled,
  auto_import = EXCLUDED.auto_import,
  import_frequency = EXCLUDED.import_frequency,
  aliases = EXCLUDED.aliases,
  updated_at = NOW();

-- Normalize legacy seed names if an older migration already inserted brand-as-name rows
UPDATE public.manufacturers
SET name = '3A Composites', brand = 'ALUCOBOND', aliases = ARRAY['Alucobond', 'ALUCOBOND', '3A'], updated_at = NOW()
WHERE slug = 'alucobond' AND name <> '3A Composites';

UPDATE public.manufacturers
SET name = 'Mitsubishi Chemical', brand = 'ALPOLIC', aliases = ARRAY['ALPOLIC', 'Mitsubishi', 'Mitsubishi Chemical Composites'], updated_at = NOW()
WHERE slug = 'alpolic' AND name <> 'Mitsubishi Chemical';

UPDATE public.manufacturers
SET name = 'Saint-Gobain Glass', aliases = ARRAY['Saint-Gobain', 'Saint-Gobain Glass UK'], updated_at = NOW()
WHERE slug = 'saint-gobain-glass';

-- Sync alias rows from manufacturers.aliases
INSERT INTO public.manufacturer_aliases (manufacturer_id, alias)
SELECT m.id, trim(alias_value)
FROM public.manufacturers m
CROSS JOIN LATERAL unnest(m.aliases) AS alias_value
WHERE trim(alias_value) <> ''
  AND lower(trim(alias_value)) <> lower(trim(m.name))
ON CONFLICT (alias) DO NOTHING;

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
    ('alpolic', 'ALPOLIC'),
    ('hunter-douglas', 'Hunter Douglas Architectural')
) AS seed(slug, alias) ON seed.slug = m.slug
WHERE lower(trim(seed.alias)) <> lower(trim(m.name))
ON CONFLICT (alias) DO NOTHING;

UPDATE public.manufacturers m
SET aliases = COALESCE((
  SELECT array_agg(a.alias ORDER BY a.alias)
  FROM public.manufacturer_aliases a
  WHERE a.manufacturer_id = m.id
), '{}'::TEXT[]),
updated_at = NOW();

-- Schedule next monthly import for enabled auto-import rows
UPDATE public.manufacturers
SET next_import_at = (
  date_trunc('month', NOW() AT TIME ZONE 'UTC')
  + INTERVAL '1 month'
  + INTERVAL '1 day'
  + INTERVAL '2 hours'
)
WHERE next_import_at IS NULL
  AND enabled = true
  AND auto_import = true
  AND import_frequency = 'monthly';

-- 4) Link materials → manufacturers (keep manufacturer TEXT for backward compat)
ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS manufacturer_id UUID REFERENCES public.manufacturers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS materials_manufacturer_id_idx
  ON public.materials (manufacturer_id)
  WHERE manufacturer_id IS NOT NULL;

-- 5) Backfill by alias, canonical name, and brand
UPDATE public.materials mat
SET
  manufacturer_id = a.manufacturer_id,
  manufacturer = r.name,
  updated_at = NOW()
FROM public.manufacturer_aliases a
JOIN public.manufacturers r ON r.id = a.manufacturer_id
WHERE lower(trim(mat.manufacturer)) = lower(trim(a.alias))
  AND (
    mat.manufacturer_id IS DISTINCT FROM a.manufacturer_id
    OR lower(trim(mat.manufacturer)) <> lower(trim(r.name))
  );

UPDATE public.materials mat
SET
  manufacturer_id = r.id,
  manufacturer = r.name,
  updated_at = NOW()
FROM public.manufacturers r
WHERE mat.manufacturer_id IS NULL
  AND lower(trim(mat.manufacturer)) = lower(trim(r.name));

UPDATE public.materials mat
SET
  manufacturer_id = r.id,
  manufacturer = r.name,
  updated_at = NOW()
FROM public.manufacturers r
WHERE mat.manufacturer_id IS NULL
  AND r.brand IS NOT NULL
  AND lower(trim(mat.manufacturer)) = lower(trim(r.brand));

UPDATE public.materials mat
SET
  manufacturer_id = r.id,
  manufacturer = r.name,
  updated_at = NOW()
FROM public.manufacturers r
WHERE mat.manufacturer_id IS NULL
  AND EXISTS (
    SELECT 1 FROM unnest(r.aliases) AS alias
    WHERE lower(trim(mat.manufacturer)) = lower(trim(alias))
  );

-- Normalize already-linked rows that still store alias/brand text
UPDATE public.materials mat
SET
  manufacturer = r.name,
  updated_at = NOW()
FROM public.manufacturers r
WHERE mat.manufacturer_id = r.id
  AND lower(trim(mat.manufacturer)) <> lower(trim(r.name));

-- 6) Refresh denormalized product counts
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

-- 7) Completion report
SELECT 'manufacturers_seeded' AS metric, COUNT(*)::INTEGER AS value
FROM public.manufacturers
UNION ALL
SELECT 'materials_linked', COUNT(*)::INTEGER
FROM public.materials
WHERE manufacturer_id IS NOT NULL
UNION ALL
SELECT 'materials_unmatched', COUNT(*)::INTEGER
FROM public.materials
WHERE manufacturer_id IS NULL
UNION ALL
SELECT 'manufacturers_with_products', COUNT(*)::INTEGER
FROM public.manufacturers
WHERE total_products > 0
UNION ALL
SELECT 'manufacturers_without_products', COUNT(*)::INTEGER
FROM public.manufacturers
WHERE total_products = 0;
