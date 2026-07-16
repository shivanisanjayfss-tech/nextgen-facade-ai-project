-- =============================================================================
-- NextGen Facade AI — Monthly import scheduler settings & manufacturer config
-- Migration: 007_import_scheduler.sql
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

CREATE TABLE IF NOT EXISTS public.import_manufacturers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer TEXT NOT NULL UNIQUE,
  brand TEXT,
  website_url TEXT NOT NULL,
  category TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS import_manufacturers_enabled_idx
  ON public.import_manufacturers (enabled, sort_order);

INSERT INTO public.import_manufacturers (manufacturer, brand, website_url, category, sort_order)
VALUES
  ('3A Composites', 'ALUCOBOND', 'https://www.alucobond.com/en/products/', 'ACP Sheet', 10),
  ('Guardian Glass', NULL, 'https://www.guardianglass.com', 'Glass', 20),
  ('AGC Glass', NULL, 'https://www.agc-yourglass.com', 'Glass', 30),
  ('Saint-Gobain Glass', NULL, 'https://www.saint-gobain-glass.co.uk/our-glass-products/', 'Glass', 40),
  ('Mitsubishi Chemical', 'ALPOLIC', 'https://www.alpolic.com/alpolic-intl/', 'ACP Sheet', 50)
ON CONFLICT (manufacturer) DO NOTHING;

GRANT SELECT, INSERT, UPDATE ON TABLE public.import_scheduler_settings TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.import_manufacturers TO anon, authenticated;

ALTER TABLE public.import_scheduler_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_manufacturers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "import_scheduler_settings_select_anon" ON public.import_scheduler_settings;
DROP POLICY IF EXISTS "import_scheduler_settings_update_anon" ON public.import_scheduler_settings;
DROP POLICY IF EXISTS "import_scheduler_settings_select_authenticated" ON public.import_scheduler_settings;
DROP POLICY IF EXISTS "import_scheduler_settings_update_authenticated" ON public.import_scheduler_settings;

CREATE POLICY "import_scheduler_settings_select_anon"
  ON public.import_scheduler_settings FOR SELECT TO anon USING (true);

CREATE POLICY "import_scheduler_settings_update_anon"
  ON public.import_scheduler_settings FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "import_scheduler_settings_select_authenticated"
  ON public.import_scheduler_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "import_scheduler_settings_update_authenticated"
  ON public.import_scheduler_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "import_manufacturers_select_anon" ON public.import_manufacturers;
DROP POLICY IF EXISTS "import_manufacturers_insert_anon" ON public.import_manufacturers;
DROP POLICY IF EXISTS "import_manufacturers_update_anon" ON public.import_manufacturers;
DROP POLICY IF EXISTS "import_manufacturers_select_authenticated" ON public.import_manufacturers;
DROP POLICY IF EXISTS "import_manufacturers_insert_authenticated" ON public.import_manufacturers;
DROP POLICY IF EXISTS "import_manufacturers_update_authenticated" ON public.import_manufacturers;

CREATE POLICY "import_manufacturers_select_anon"
  ON public.import_manufacturers FOR SELECT TO anon USING (true);

CREATE POLICY "import_manufacturers_insert_anon"
  ON public.import_manufacturers FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "import_manufacturers_update_anon"
  ON public.import_manufacturers FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "import_manufacturers_select_authenticated"
  ON public.import_manufacturers FOR SELECT TO authenticated USING (true);

CREATE POLICY "import_manufacturers_insert_authenticated"
  ON public.import_manufacturers FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "import_manufacturers_update_authenticated"
  ON public.import_manufacturers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
