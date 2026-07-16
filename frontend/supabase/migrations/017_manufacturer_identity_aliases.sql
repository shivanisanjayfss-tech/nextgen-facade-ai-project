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
