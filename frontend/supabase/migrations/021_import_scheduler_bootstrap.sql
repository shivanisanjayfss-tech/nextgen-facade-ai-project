-- =============================================================================
-- NextGen Facade AI — Import scheduler & history bootstrap (idempotent)
-- Migration: 021_import_scheduler_bootstrap.sql
--
-- Creates import_scheduler_settings (with live progress columns) and
-- import_history when missing. Safe to re-run after partial migrations.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.import_scheduler_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  enabled BOOLEAN NOT NULL DEFAULT true,
  frequency TEXT NOT NULL DEFAULT 'monthly',
  cron_expression TEXT NOT NULL DEFAULT '0 2 1 * *',
  schedule_hour INTEGER NOT NULL DEFAULT 2,
  schedule_day_of_month INTEGER NOT NULL DEFAULT 1,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  last_successful_run_at TIMESTAMPTZ,
  last_failed_run_at TIMESTAMPTZ,
  currently_running_manufacturer TEXT,
  last_run_trigger TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.import_scheduler_settings (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.import_scheduler_settings
  ADD COLUMN IF NOT EXISTS run_in_progress BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS progress_manufacturer_index INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS progress_manufacturer_total INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS progress_imported INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS progress_updated INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS progress_skipped INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS progress_failed INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS progress_stage TEXT,
  ADD COLUMN IF NOT EXISTS progress_detail TEXT,
  ADD COLUMN IF NOT EXISTS last_run_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_run_finished_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_run_duration_seconds NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS last_run_imported INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_run_updated INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_run_skipped INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_run_failed INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.import_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',
  imported INTEGER NOT NULL DEFAULT 0,
  updated INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,
  ignored INTEGER NOT NULL DEFAULT 0,
  duration_seconds NUMERIC(10, 2),
  error_message TEXT
);

ALTER TABLE public.import_history
  ADD COLUMN IF NOT EXISTS failed INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extracted_products INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS product_decisions JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS import_history_manufacturer_idx
  ON public.import_history (manufacturer);

CREATE INDEX IF NOT EXISTS import_history_started_at_idx
  ON public.import_history (started_at DESC);

GRANT SELECT, INSERT, UPDATE ON TABLE public.import_scheduler_settings TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.import_history TO anon, authenticated;

ALTER TABLE public.import_scheduler_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "import_scheduler_settings_select_anon" ON public.import_scheduler_settings;
DROP POLICY IF EXISTS "import_scheduler_settings_update_anon" ON public.import_scheduler_settings;
DROP POLICY IF EXISTS "import_scheduler_settings_insert_anon" ON public.import_scheduler_settings;
DROP POLICY IF EXISTS "import_scheduler_settings_select_authenticated" ON public.import_scheduler_settings;
DROP POLICY IF EXISTS "import_scheduler_settings_update_authenticated" ON public.import_scheduler_settings;
DROP POLICY IF EXISTS "import_scheduler_settings_insert_authenticated" ON public.import_scheduler_settings;

CREATE POLICY "import_scheduler_settings_select_anon"
  ON public.import_scheduler_settings FOR SELECT TO anon USING (true);

CREATE POLICY "import_scheduler_settings_update_anon"
  ON public.import_scheduler_settings FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "import_scheduler_settings_insert_anon"
  ON public.import_scheduler_settings FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "import_scheduler_settings_select_authenticated"
  ON public.import_scheduler_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "import_scheduler_settings_update_authenticated"
  ON public.import_scheduler_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "import_scheduler_settings_insert_authenticated"
  ON public.import_scheduler_settings FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "import_history_select_anon" ON public.import_history;
DROP POLICY IF EXISTS "import_history_insert_anon" ON public.import_history;
DROP POLICY IF EXISTS "import_history_update_anon" ON public.import_history;
DROP POLICY IF EXISTS "import_history_select_authenticated" ON public.import_history;
DROP POLICY IF EXISTS "import_history_insert_authenticated" ON public.import_history;
DROP POLICY IF EXISTS "import_history_update_authenticated" ON public.import_history;

CREATE POLICY "import_history_select_anon"
  ON public.import_history FOR SELECT TO anon USING (true);

CREATE POLICY "import_history_insert_anon"
  ON public.import_history FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "import_history_update_anon"
  ON public.import_history FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "import_history_select_authenticated"
  ON public.import_history FOR SELECT TO authenticated USING (true);

CREATE POLICY "import_history_insert_authenticated"
  ON public.import_history FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "import_history_update_authenticated"
  ON public.import_history FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
