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
