-- =============================================================================
-- NextGen Facade AI — Manufacturer platform configuration
-- Migration: 012_manufacturer_platform_config.sql
-- =============================================================================

ALTER TABLE public.import_manufacturers
  ADD COLUMN IF NOT EXISTS strategy_key TEXT NOT NULL DEFAULT 'generic',
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS slug TEXT;

UPDATE public.import_manufacturers
SET slug = lower(regexp_replace(regexp_replace(trim(manufacturer), '[^a-zA-Z0-9]+', '-', 'g'), '(^-+|-+$)', '', 'g'))
WHERE slug IS NULL OR slug = '';

CREATE UNIQUE INDEX IF NOT EXISTS import_manufacturers_slug_idx
  ON public.import_manufacturers (slug);

UPDATE public.import_manufacturers
SET strategy_key = CASE manufacturer
  WHEN '3A Composites' THEN 'alucobond'
  WHEN 'Guardian Glass' THEN 'guardian-glass'
  WHEN 'AGC Glass' THEN 'agc-glass'
  WHEN 'Saint-Gobain Glass' THEN 'saint-gobain'
  WHEN 'Mitsubishi Chemical' THEN 'mitsubishi-chemical'
  ELSE COALESCE(strategy_key, 'generic')
END
WHERE strategy_key = 'generic';
