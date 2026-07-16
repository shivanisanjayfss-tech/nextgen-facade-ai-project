-- =============================================================================
-- NextGen Facade AI — Active flag for discontinued products
-- Migration: 006_materials_is_active.sql
-- =============================================================================

ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS materials_is_active_idx
  ON public.materials (is_active)
  WHERE is_active = true;
