-- =============================================================================
-- Phase 4: AI Datasheet Intelligence
-- Stores PDF extraction, AI structured fields, and search facets per material.
-- =============================================================================

CREATE TABLE IF NOT EXISTS material_datasheet_intelligence (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id         UUID        NOT NULL UNIQUE REFERENCES materials (id) ON DELETE CASCADE,
  source_url          TEXT        NOT NULL,
  status              TEXT        NOT NULL DEFAULT 'pending'
                        CHECK (status IN (
                          'pending',
                          'downloading',
                          'extracting',
                          'analyzing',
                          'completed',
                          'failed'
                        )),
  extraction_status   TEXT,
  page_count          INTEGER,
  raw_pages           JSONB       NOT NULL DEFAULT '[]',
  extracted_fields    JSONB       NOT NULL DEFAULT '{}',
  manual_overrides    JSONB       NOT NULL DEFAULT '{}',
  ai_summary          TEXT,
  technical_highlights TEXT[]     NOT NULL DEFAULT '{}',
  -- Denormalized facets for fast filtering
  fire_rating         TEXT,
  thickness           TEXT,
  finish              TEXT,
  thermal_value       TEXT,
  certifications      TEXT[]      NOT NULL DEFAULT '{}',
  search_text         TEXT        NOT NULL DEFAULT '',
  error_message       TEXT,
  processed_at        TIMESTAMPTZ,
  reviewed_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS material_datasheet_intelligence_status_idx
  ON material_datasheet_intelligence (status);

CREATE INDEX IF NOT EXISTS material_datasheet_intelligence_fire_rating_idx
  ON material_datasheet_intelligence (fire_rating)
  WHERE fire_rating IS NOT NULL;

CREATE INDEX IF NOT EXISTS material_datasheet_intelligence_thickness_idx
  ON material_datasheet_intelligence (thickness)
  WHERE thickness IS NOT NULL;

CREATE INDEX IF NOT EXISTS material_datasheet_intelligence_finish_idx
  ON material_datasheet_intelligence (finish)
  WHERE finish IS NOT NULL;

CREATE INDEX IF NOT EXISTS material_datasheet_intelligence_thermal_idx
  ON material_datasheet_intelligence (thermal_value)
  WHERE thermal_value IS NOT NULL;

CREATE INDEX IF NOT EXISTS material_datasheet_intelligence_certifications_idx
  ON material_datasheet_intelligence USING gin (certifications);

CREATE INDEX IF NOT EXISTS material_datasheet_intelligence_search_text_trgm_idx
  ON material_datasheet_intelligence USING gin (search_text gin_trgm_ops);

CREATE INDEX IF NOT EXISTS material_datasheet_intelligence_extracted_fields_gin_idx
  ON material_datasheet_intelligence USING gin (extracted_fields);

CREATE TRIGGER material_datasheet_intelligence_set_updated_at
  BEFORE UPDATE ON material_datasheet_intelligence
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE material_datasheet_intelligence DISABLE ROW LEVEL SECURITY;

-- Enqueue intelligence processing when a material gains or changes a datasheet URL.
CREATE OR REPLACE FUNCTION enqueue_material_datasheet_intelligence()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.datasheet_url IS NOT NULL
     AND btrim(NEW.datasheet_url) <> ''
     AND (
       TG_OP = 'INSERT'
       OR OLD.datasheet_url IS DISTINCT FROM NEW.datasheet_url
     ) THEN
    INSERT INTO material_datasheet_intelligence (
      material_id,
      source_url,
      status,
      extraction_status
    )
    VALUES (
      NEW.id,
      NEW.datasheet_url,
      'pending',
      'queued'
    )
    ON CONFLICT (material_id) DO UPDATE SET
      source_url = EXCLUDED.source_url,
      status = 'pending',
      extraction_status = 'queued',
      error_message = NULL,
      updated_at = NOW()
    WHERE material_datasheet_intelligence.source_url IS DISTINCT FROM EXCLUDED.source_url
       OR material_datasheet_intelligence.status = 'failed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS materials_enqueue_datasheet_intelligence ON materials;

CREATE TRIGGER materials_enqueue_datasheet_intelligence
  AFTER INSERT OR UPDATE OF datasheet_url ON materials
  FOR EACH ROW
  EXECUTE FUNCTION enqueue_material_datasheet_intelligence();

-- Backfill pending rows for existing materials with datasheet URLs.
INSERT INTO material_datasheet_intelligence (material_id, source_url, status, extraction_status)
SELECT
  m.id,
  m.datasheet_url,
  'pending',
  'queued'
FROM materials m
WHERE m.datasheet_url IS NOT NULL
  AND btrim(m.datasheet_url) <> ''
ON CONFLICT (material_id) DO NOTHING;
