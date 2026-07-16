-- =============================================================================
-- NextGen Facade AI — Platform analytics events
-- Migration: 013_analytics_events.sql
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name TEXT NOT NULL,
  user_id UUID,
  session_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS analytics_events_name_created_idx
  ON public.analytics_events (event_name, created_at DESC);

CREATE INDEX IF NOT EXISTS analytics_events_created_at_idx
  ON public.analytics_events (created_at DESC);

GRANT SELECT, INSERT ON TABLE public.analytics_events TO anon, authenticated;

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "analytics_events_insert_anon" ON public.analytics_events;
DROP POLICY IF EXISTS "analytics_events_select_anon" ON public.analytics_events;

CREATE POLICY "analytics_events_insert_anon"
  ON public.analytics_events FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "analytics_events_select_anon"
  ON public.analytics_events FOR SELECT TO anon USING (true);
