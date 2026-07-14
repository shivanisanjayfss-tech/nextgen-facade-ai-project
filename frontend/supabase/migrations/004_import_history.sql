-- =============================================================================
-- NextGen Facade AI — Import history for scheduled / automatic imports
-- Migration: 004_import_history.sql
--
-- Run in Supabase Dashboard → SQL Editor
-- =============================================================================

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

CREATE INDEX IF NOT EXISTS import_history_manufacturer_idx
  ON public.import_history (manufacturer);

CREATE INDEX IF NOT EXISTS import_history_started_at_idx
  ON public.import_history (started_at DESC);

GRANT SELECT, INSERT, UPDATE ON TABLE public.import_history TO anon, authenticated;

ALTER TABLE public.import_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "import_history_select_anon" ON public.import_history;
DROP POLICY IF EXISTS "import_history_insert_anon" ON public.import_history;
DROP POLICY IF EXISTS "import_history_update_anon" ON public.import_history;
DROP POLICY IF EXISTS "import_history_select_authenticated" ON public.import_history;
DROP POLICY IF EXISTS "import_history_insert_authenticated" ON public.import_history;
DROP POLICY IF EXISTS "import_history_update_authenticated" ON public.import_history;

CREATE POLICY "import_history_select_anon"
  ON public.import_history
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "import_history_insert_anon"
  ON public.import_history
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "import_history_update_anon"
  ON public.import_history
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "import_history_select_authenticated"
  ON public.import_history
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "import_history_insert_authenticated"
  ON public.import_history
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "import_history_update_authenticated"
  ON public.import_history
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
