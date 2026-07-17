-- =============================================================================
-- NextGen Facade AI — Import history baseline (pre-022 schema)
-- Migration: 020a_import_history_baseline.sql
--
-- Creates import_history with the full column set expected by import-history
-- services and the Import History API (004 + 008 + 010 combined).
--
-- Apply order (required before 022):
--   1) 020a_import_history_baseline.sql   ← this file
--   2) 021_import_scheduler_bootstrap.sql
--   3) 022_import_diagnostics.sql
--
-- Idempotent — safe to re-run.
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
  failed INTEGER NOT NULL DEFAULT 0,
  ignored INTEGER NOT NULL DEFAULT 0,
  duration_seconds NUMERIC(10, 2),
  error_message TEXT,
  extracted_products INTEGER NOT NULL DEFAULT 0,
  product_decisions JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- Backfill columns when an older 004-only table already exists.
ALTER TABLE public.import_history
  ADD COLUMN IF NOT EXISTS failed INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extracted_products INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS product_decisions JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS import_history_manufacturer_idx
  ON public.import_history (manufacturer);

CREATE INDEX IF NOT EXISTS import_history_started_at_idx
  ON public.import_history (started_at DESC);

CREATE INDEX IF NOT EXISTS import_history_status_idx
  ON public.import_history (status);

GRANT SELECT, INSERT, UPDATE ON TABLE public.import_history TO anon, authenticated;

ALTER TABLE public.import_history ENABLE ROW LEVEL SECURITY;

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
