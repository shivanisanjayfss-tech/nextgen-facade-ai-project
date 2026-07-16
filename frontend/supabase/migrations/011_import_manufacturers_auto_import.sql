-- =============================================================================
-- NextGen Facade AI — Dynamic scheduler manufacturer queue
-- Migration: 011_import_manufacturers_auto_import.sql
-- =============================================================================

ALTER TABLE public.import_manufacturers
  ADD COLUMN IF NOT EXISTS auto_import BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS import_manufacturers_scheduler_queue_idx
  ON public.import_manufacturers (enabled, auto_import, sort_order);

-- Existing enabled rows participate in scheduled imports by default.
UPDATE public.import_manufacturers
SET auto_import = true
WHERE enabled = true AND auto_import IS DISTINCT FROM true;
