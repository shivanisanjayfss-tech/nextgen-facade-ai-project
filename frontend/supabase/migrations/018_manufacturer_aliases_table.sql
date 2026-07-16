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
