-- =============================================================================
-- NextGen Facade AI — Rename material category ACP → ACP Sheet
-- Migration: 005_rename_acp_to_acp_sheet.sql
--
-- Run in Supabase Dashboard → SQL Editor
-- =============================================================================

-- Migrate existing material and datasheet rows.
UPDATE public.materials
SET category = 'ACP Sheet'
WHERE category = 'ACP';

UPDATE public.datasheets
SET category = 'ACP Sheet'
WHERE category = 'ACP';

-- Update category tags stored in tag arrays.
UPDATE public.materials
SET tags = array_replace(tags, 'ACP', 'ACP Sheet')
WHERE 'ACP' = ANY(tags);

UPDATE public.knowledge_articles
SET tags = array_replace(tags, 'ACP', 'ACP Sheet')
WHERE 'ACP' = ANY(tags);

-- Replace the materials category CHECK constraint.
ALTER TABLE public.materials
  DROP CONSTRAINT IF EXISTS materials_category_check;

ALTER TABLE public.materials
  ADD CONSTRAINT materials_category_check
  CHECK (category IN (
    'ACP Sheet', 'Glass', 'Stone', 'HPL', 'Louvers', 'Metal', 'Composite', 'Other'
  ));
