-- =============================================================================
-- NextGen Facade AI — Import diagnostics persistence (Phase 3a)
-- Migration: 022_import_diagnostics.sql
--
-- Adds batch run tracking, structured event logs, and crawl diagnostics on
-- import_history. Idempotent — safe to re-run.
-- =============================================================================

-- 1) Batch scheduler runs (one row per cron / Run Now execution)
CREATE TABLE IF NOT EXISTS public.import_scheduler_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  duration_seconds NUMERIC(10, 2),
  status TEXT NOT NULL DEFAULT 'running',
  manufacturer_total INTEGER NOT NULL DEFAULT 0,
  imported INTEGER NOT NULL DEFAULT 0,
  updated INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  ignored INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS import_scheduler_runs_started_at_idx
  ON public.import_scheduler_runs (started_at DESC);

CREATE INDEX IF NOT EXISTS import_scheduler_runs_status_idx
  ON public.import_scheduler_runs (status);

-- 2) Structured pipeline events
CREATE TABLE IF NOT EXISTS public.import_run_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduler_run_id UUID REFERENCES public.import_scheduler_runs(id) ON DELETE CASCADE,
  import_history_id UUID REFERENCES public.import_history(id) ON DELETE CASCADE,
  manufacturer TEXT,
  stage TEXT NOT NULL,
  detail TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS import_run_events_scheduler_run_id_idx
  ON public.import_run_events (scheduler_run_id, created_at);

CREATE INDEX IF NOT EXISTS import_run_events_import_history_id_idx
  ON public.import_run_events (import_history_id, created_at);

CREATE INDEX IF NOT EXISTS import_run_events_stage_idx
  ON public.import_run_events (stage);

-- 3) Extend import_history with diagnostics linkage
ALTER TABLE public.import_history
  ADD COLUMN IF NOT EXISTS scheduler_run_id UUID REFERENCES public.import_scheduler_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS manufacturer_id UUID REFERENCES public.manufacturers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS trigger TEXT,
  ADD COLUMN IF NOT EXISTS strategy_key TEXT,
  ADD COLUMN IF NOT EXISTS crawl_status TEXT,
  ADD COLUMN IF NOT EXISTS crawled_pages INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS apify_run_id TEXT,
  ADD COLUMN IF NOT EXISTS apify_run_url TEXT,
  ADD COLUMN IF NOT EXISTS diagnostics JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS import_history_scheduler_run_id_idx
  ON public.import_history (scheduler_run_id);

CREATE INDEX IF NOT EXISTS import_history_manufacturer_id_idx
  ON public.import_history (manufacturer_id);

CREATE INDEX IF NOT EXISTS import_history_trigger_idx
  ON public.import_history (trigger);

CREATE INDEX IF NOT EXISTS import_history_status_idx
  ON public.import_history (status);

-- 4) RLS + grants (match existing import_history pattern)
GRANT SELECT, INSERT, UPDATE ON TABLE public.import_scheduler_runs TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.import_run_events TO anon, authenticated;

ALTER TABLE public.import_scheduler_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_run_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "import_scheduler_runs_select_anon" ON public.import_scheduler_runs;
DROP POLICY IF EXISTS "import_scheduler_runs_insert_anon" ON public.import_scheduler_runs;
DROP POLICY IF EXISTS "import_scheduler_runs_update_anon" ON public.import_scheduler_runs;
DROP POLICY IF EXISTS "import_scheduler_runs_select_authenticated" ON public.import_scheduler_runs;
DROP POLICY IF EXISTS "import_scheduler_runs_insert_authenticated" ON public.import_scheduler_runs;
DROP POLICY IF EXISTS "import_scheduler_runs_update_authenticated" ON public.import_scheduler_runs;

CREATE POLICY "import_scheduler_runs_select_anon"
  ON public.import_scheduler_runs FOR SELECT TO anon USING (true);

CREATE POLICY "import_scheduler_runs_insert_anon"
  ON public.import_scheduler_runs FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "import_scheduler_runs_update_anon"
  ON public.import_scheduler_runs FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "import_scheduler_runs_select_authenticated"
  ON public.import_scheduler_runs FOR SELECT TO authenticated USING (true);

CREATE POLICY "import_scheduler_runs_insert_authenticated"
  ON public.import_scheduler_runs FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "import_scheduler_runs_update_authenticated"
  ON public.import_scheduler_runs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "import_run_events_select_anon" ON public.import_run_events;
DROP POLICY IF EXISTS "import_run_events_insert_anon" ON public.import_run_events;
DROP POLICY IF EXISTS "import_run_events_select_authenticated" ON public.import_run_events;
DROP POLICY IF EXISTS "import_run_events_insert_authenticated" ON public.import_run_events;

CREATE POLICY "import_run_events_select_anon"
  ON public.import_run_events FOR SELECT TO anon USING (true);

CREATE POLICY "import_run_events_insert_anon"
  ON public.import_run_events FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "import_run_events_select_authenticated"
  ON public.import_run_events FOR SELECT TO authenticated USING (true);

CREATE POLICY "import_run_events_insert_authenticated"
  ON public.import_run_events FOR INSERT TO authenticated WITH CHECK (true);
