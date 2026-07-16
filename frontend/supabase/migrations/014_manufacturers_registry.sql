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
