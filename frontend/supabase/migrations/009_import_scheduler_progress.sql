-- =============================================================================
-- NextGen Facade AI — Scheduler run progress & INSERT policy fix
-- Migration: 009_import_scheduler_progress.sql
-- =============================================================================

ALTER TABLE public.import_scheduler_settings
  ADD COLUMN IF NOT EXISTS run_in_progress BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS progress_manufacturer_index INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS progress_manufacturer_total INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS progress_imported INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS progress_updated INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS progress_skipped INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS progress_failed INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_run_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_run_finished_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_run_duration_seconds NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS last_run_imported INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_run_updated INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_run_skipped INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_run_failed INTEGER NOT NULL DEFAULT 0;

DROP POLICY IF EXISTS "import_scheduler_settings_insert_anon" ON public.import_scheduler_settings;
DROP POLICY IF EXISTS "import_scheduler_settings_insert_authenticated" ON public.import_scheduler_settings;

CREATE POLICY "import_scheduler_settings_insert_anon"
  ON public.import_scheduler_settings FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "import_scheduler_settings_insert_authenticated"
  ON public.import_scheduler_settings FOR INSERT TO authenticated WITH CHECK (true);
