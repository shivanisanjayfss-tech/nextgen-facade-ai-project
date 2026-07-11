-- =============================================================================
-- NextGen Facade AI — Materials table RLS + SELECT grants
-- Migration: 002_materials_select_policies.sql
--
-- Run in Supabase Dashboard → SQL Editor
--
-- Context:
--   The app uses NEXT_PUBLIC_SUPABASE_ANON_KEY (role: anon) for all reads.
--   Error "permission denied for table materials" occurs when:
--     1) anon/authenticated lack table-level SELECT grants, or
--     2) RLS is enabled without matching SELECT policies.
--
-- This migration keeps RLS enabled and allows public read access.
-- =============================================================================

-- Ensure API roles can access the public schema
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Table-level SELECT required before RLS policies apply
GRANT SELECT ON TABLE public.materials TO anon, authenticated;

-- Enable RLS (no-op if already enabled)
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

-- Replace any existing read policies for idempotency
DROP POLICY IF EXISTS "materials_select_anon" ON public.materials;
DROP POLICY IF EXISTS "materials_select_authenticated" ON public.materials;

-- Allow unauthenticated API access via the anon key
CREATE POLICY "materials_select_anon"
  ON public.materials
  FOR SELECT
  TO anon
  USING (true);

-- Allow logged-in users to read materials
CREATE POLICY "materials_select_authenticated"
  ON public.materials
  FOR SELECT
  TO authenticated
  USING (true);

-- Verify
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  pol.polname AS policy_name,
  pol.polroles::regrole[] AS roles,
  pol.polcmd AS command
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policy pol ON pol.polrelid = c.oid
WHERE n.nspname = 'public'
  AND c.relname = 'materials'
ORDER BY pol.polname;
