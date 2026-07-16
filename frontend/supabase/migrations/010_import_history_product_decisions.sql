-- =============================================================================
-- NextGen Facade AI — Per-product import decisions on import history
-- Migration: 010_import_history_product_decisions.sql
-- =============================================================================

ALTER TABLE public.import_history
  ADD COLUMN IF NOT EXISTS product_decisions JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS extracted_products INTEGER NOT NULL DEFAULT 0;
