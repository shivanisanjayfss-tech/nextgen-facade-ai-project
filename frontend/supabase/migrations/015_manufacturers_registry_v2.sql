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
