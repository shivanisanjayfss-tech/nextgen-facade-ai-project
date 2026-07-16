-- =============================================================================
-- NextGen Facade AI — Manufacturer Registry create defaults
-- Migration: 016_manufacturer_registry_create_defaults.sql
-- =============================================================================

-- Ensure new registry rows default into the monthly automatic import queue.
ALTER TABLE public.manufacturers
  ALTER COLUMN enabled SET DEFAULT true,
  ALTER COLUMN auto_import SET DEFAULT true,
  ALTER COLUMN import_frequency SET DEFAULT 'monthly',
  ALTER COLUMN import_strategy SET DEFAULT 'generic',
  ALTER COLUMN total_products SET DEFAULT 0;

-- Backfill next_import_at for enabled auto-import rows missing a schedule.
UPDATE public.manufacturers
SET next_import_at = (
  CASE
    WHEN EXTRACT(DAY FROM NOW() AT TIME ZONE 'UTC') < 1
      OR (
        EXTRACT(DAY FROM NOW() AT TIME ZONE 'UTC') = 1
        AND EXTRACT(HOUR FROM NOW() AT TIME ZONE 'UTC') < 2
      )
    THEN date_trunc('month', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 day' + INTERVAL '2 hours'
    ELSE date_trunc('month', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 month' + INTERVAL '1 day' + INTERVAL '2 hours'
  END
)
WHERE next_import_at IS NULL
  AND enabled = true
  AND auto_import = true
  AND import_frequency = 'monthly';
