-- =============================================================================
-- NextGen Facade AI — Failed product count on import history
-- Migration: 008_import_history_failed.sql
-- =============================================================================

ALTER TABLE public.import_history
  ADD COLUMN IF NOT EXISTS failed INTEGER NOT NULL DEFAULT 0;
