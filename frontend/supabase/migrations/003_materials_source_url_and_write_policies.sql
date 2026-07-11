-- =============================================================================
-- NextGen Facade AI — Materials source_url + write policies for import pipeline
-- Migration: 003_materials_source_url_and_write_policies.sql
--
-- Run in Supabase Dashboard → SQL Editor
-- =============================================================================

-- Track the canonical crawl source for deduplication during imports.
ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS source_url TEXT;

-- Unique constraint for import deduplication (PostgreSQL allows multiple NULLs).
-- Used by the import pipeline upsert(onConflict: 'source_url').
ALTER TABLE public.materials
  DROP CONSTRAINT IF EXISTS materials_source_url_key;

ALTER TABLE public.materials
  ADD CONSTRAINT materials_source_url_key UNIQUE (source_url);

-- slug already has UNIQUE NOT NULL from migration 001 — used as fallback onConflict target.

-- Write access required for the server-side import pipeline (anon key).
GRANT INSERT, UPDATE ON TABLE public.materials TO anon, authenticated;

DROP POLICY IF EXISTS "materials_insert_anon" ON public.materials;
DROP POLICY IF EXISTS "materials_update_anon" ON public.materials;
DROP POLICY IF EXISTS "materials_insert_authenticated" ON public.materials;
DROP POLICY IF EXISTS "materials_update_authenticated" ON public.materials;

CREATE POLICY "materials_insert_anon"
  ON public.materials
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "materials_update_anon"
  ON public.materials
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "materials_insert_authenticated"
  ON public.materials
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "materials_update_authenticated"
  ON public.materials
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
