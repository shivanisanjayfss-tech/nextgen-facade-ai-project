import {
  buildSearchFacets,
  buildSearchText,
  mergeEffectiveFields,
  parseExtractedFieldsRecord,
  parseManualOverridesRecord,
  sanitizeManualOverridesInput,
} from "@/lib/datasheet-intelligence-fields";
import { extractDatasheetIntelligenceWithAi } from "@/lib/datasheet-ai-extraction";
import {
  buildPromptTextFromPages,
  downloadPdf,
  extractPdfTextByPage,
} from "@/lib/pdf-text-extraction";
import { ServiceError } from "@/lib/errors";
import { raiseSupabaseError } from "@/lib/supabase-errors";
import {
  isRangeBeyondTotal,
  isRangeNotSatisfiableError,
  normalizePagination,
} from "@/lib/pagination";
import { getSupabaseServer } from "@/lib/supabase";
import type { MaterialDatasheetIntelligenceRow, MaterialRow } from "@/types/database";
import { DB_TABLES } from "@/types/database";
import type {
  DatasheetExtractedFields,
  DatasheetIntelligence,
  DatasheetIntelligenceSearchHit,
  DatasheetIntelligenceSearchParams,
  DatasheetIntelligenceSearchResult,
  DatasheetIntelligenceStatus,
  DatasheetProcessResult,
} from "@/types/datasheet-intelligence";

function escapeIlikePattern(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}

function mapIntelligenceRow(
  row: MaterialDatasheetIntelligenceRow,
): DatasheetIntelligence {
  const extractedFields = parseExtractedFieldsRecord(row.extracted_fields);
  const manualOverrides = parseManualOverridesRecord(row.manual_overrides);

  return {
    id: row.id,
    materialId: row.material_id,
    sourceUrl: row.source_url,
    status: row.status as DatasheetIntelligenceStatus,
    extractionStatus: row.extraction_status as DatasheetIntelligence["extractionStatus"],
    pageCount: row.page_count,
    rawPages: row.raw_pages ?? [],
    extractedFields,
    manualOverrides,
    effectiveFields: mergeEffectiveFields(extractedFields, manualOverrides),
    aiSummary: row.ai_summary,
    technicalHighlights: row.technical_highlights ?? [],
    fireRating: row.fire_rating,
    thickness: row.thickness,
    finish: row.finish,
    thermalValue: row.thermal_value,
    certifications: row.certifications ?? [],
    errorMessage: row.error_message,
    processedAt: row.processed_at,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getMaterialForProcessing(materialId: string): Promise<MaterialRow> {
  const supabase = getSupabaseServer();
  if (!supabase) {
    throw new ServiceError("Supabase is not configured.", "SUPABASE_NOT_CONFIGURED", 503);
  }

  const { data, error } = await supabase
    .from(DB_TABLES.materials)
    .select("*")
    .eq("id", materialId)
    .maybeSingle();

  if (error) raiseSupabaseError(error, "getMaterialForProcessing");
  if (!data) {
    throw new ServiceError("Material not found.", "MATERIAL_NOT_FOUND", 404);
  }

  return data as MaterialRow;
}

async function getIntelligenceRow(
  materialId: string,
): Promise<MaterialDatasheetIntelligenceRow | null> {
  const supabase = getSupabaseServer();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from(DB_TABLES.materialDatasheetIntelligence)
    .select("*")
    .eq("material_id", materialId)
    .maybeSingle();

  if (error) raiseSupabaseError(error, "getIntelligenceRow");
  return (data as MaterialDatasheetIntelligenceRow | null) ?? null;
}

async function upsertDatasheetCatalogueRow(
  material: MaterialRow,
  sourceUrl: string,
  pageCount: number | null,
): Promise<void> {
  const supabase = getSupabaseServer();
  if (!supabase) return;

  const { data: existing } = await supabase
    .from(DB_TABLES.datasheets)
    .select("id")
    .eq("material_id", material.id)
    .maybeSingle();

  const payload = {
    material_id: material.id,
    title: `${material.name} Datasheet`,
    manufacturer: material.manufacturer,
    category: material.category,
    file_url: sourceUrl,
    pages: pageCount,
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    await supabase.from(DB_TABLES.datasheets).update(payload).eq("id", existing.id);
    return;
  }

  await supabase.from(DB_TABLES.datasheets).insert({
    ...payload,
    published_at: new Date().toISOString(),
  });
}

async function updateIntelligenceRow(
  materialId: string,
  patch: Partial<MaterialDatasheetIntelligenceRow>,
): Promise<MaterialDatasheetIntelligenceRow> {
  const supabase = getSupabaseServer();
  if (!supabase) {
    throw new ServiceError("Supabase is not configured.", "SUPABASE_NOT_CONFIGURED", 503);
  }

  const { data, error } = await supabase
    .from(DB_TABLES.materialDatasheetIntelligence)
    .update(patch)
    .eq("material_id", materialId)
    .select("*")
    .single();

  if (error) raiseSupabaseError(error, "updateIntelligenceRow");
  return data as MaterialDatasheetIntelligenceRow;
}

/** Processes a single material datasheet through download → extract → AI. */
export async function processDatasheetIntelligence(
  materialId: string,
): Promise<DatasheetProcessResult> {
  const material = await getMaterialForProcessing(materialId);
  const datasheetUrl = material.datasheet_url?.trim();

  if (!datasheetUrl) {
    throw new ServiceError(
      "Material has no datasheet URL to process.",
      "DATASHEET_URL_MISSING",
      400,
    );
  }

  let row = await getIntelligenceRow(materialId);
  if (!row) {
    const supabase = getSupabaseServer();
    if (!supabase) {
      throw new ServiceError("Supabase is not configured.", "SUPABASE_NOT_CONFIGURED", 503);
    }

    const { data, error } = await supabase
      .from(DB_TABLES.materialDatasheetIntelligence)
      .insert({
        material_id: materialId,
        source_url: datasheetUrl,
        status: "pending",
        extraction_status: "queued",
      })
      .select("*")
      .single();

    if (error) raiseSupabaseError(error, "processDatasheetIntelligence(insert)");
    row = data as MaterialDatasheetIntelligenceRow;
  }

  try {
    row = await updateIntelligenceRow(materialId, {
      source_url: datasheetUrl,
      status: "downloading",
      extraction_status: "downloading",
      error_message: null,
    });

    const download = await downloadPdf(datasheetUrl);

    row = await updateIntelligenceRow(materialId, {
      status: "extracting",
      extraction_status: "downloading",
    });

    const extraction = await extractPdfTextByPage(download.buffer);

    row = await updateIntelligenceRow(materialId, {
      status: "analyzing",
      extraction_status: "text_extracted",
      page_count: extraction.pageCount,
      raw_pages: extraction.pages,
    });

    const promptText = buildPromptTextFromPages(extraction.pages);
    const aiResult = await extractDatasheetIntelligenceWithAi(promptText, {
      materialName: material.name,
      manufacturer: material.manufacturer,
      category: material.category,
    });

    const effectiveFields = mergeEffectiveFields(aiResult.extractedFields, {});
    const facets = buildSearchFacets(effectiveFields);
    const searchText = buildSearchText(
      extraction.pages,
      effectiveFields,
      aiResult.aiSummary,
      aiResult.technicalHighlights,
    );

    row = await updateIntelligenceRow(materialId, {
      status: "completed",
      extraction_status: "completed",
      extracted_fields: aiResult.extractedFields as unknown as Record<string, unknown>,
      ai_summary: aiResult.aiSummary,
      technical_highlights: aiResult.technicalHighlights,
      fire_rating: facets.fireRating,
      thickness: facets.thickness,
      finish: facets.finish,
      thermal_value: facets.thermalValue,
      certifications: facets.certifications,
      search_text: searchText,
      processed_at: new Date().toISOString(),
      error_message: null,
    });

    await upsertDatasheetCatalogueRow(material, datasheetUrl, extraction.pageCount);

    return {
      materialId,
      status: row.status as DatasheetIntelligenceStatus,
      extractionStatus: row.extraction_status as DatasheetProcessResult["extractionStatus"],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Datasheet processing failed.";

    await updateIntelligenceRow(materialId, {
      status: "failed",
      extraction_status: "failed",
      error_message: message,
    }).catch(() => undefined);

    return {
      materialId,
      status: "failed",
      extractionStatus: "failed",
      errorMessage: message,
    };
  }
}

/** Processes pending datasheet intelligence rows (batch). */
export async function processPendingDatasheetIntelligence(
  limit = 5,
): Promise<DatasheetProcessResult[]> {
  const supabase = getSupabaseServer();
  if (!supabase) {
    throw new ServiceError("Supabase is not configured.", "SUPABASE_NOT_CONFIGURED", 503);
  }

  const { data, error } = await supabase
    .from(DB_TABLES.materialDatasheetIntelligence)
    .select("material_id")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) raiseSupabaseError(error, "processPendingDatasheetIntelligence");

  const rows = (data ?? []) as Array<{ material_id: string }>;
  const results: DatasheetProcessResult[] = [];

  for (const row of rows) {
    results.push(await processDatasheetIntelligence(row.material_id));
  }

  return results;
}

/** Fetches datasheet intelligence for a material. */
export async function getDatasheetIntelligenceByMaterialId(
  materialId: string,
): Promise<DatasheetIntelligence | null> {
  const row = await getIntelligenceRow(materialId);
  return row ? mapIntelligenceRow(row) : null;
}

/** Saves manual reviewer overrides for extracted fields. */
export async function updateDatasheetManualReview(
  materialId: string,
  overrides: Partial<DatasheetExtractedFields>,
): Promise<DatasheetIntelligence> {
  const row = await getIntelligenceRow(materialId);
  if (!row) {
    throw new ServiceError(
      "Datasheet intelligence not found for material.",
      "DATASHEET_INTELLIGENCE_NOT_FOUND",
      404,
    );
  }

  const sanitized = sanitizeManualOverridesInput(overrides);
  const extractedFields = parseExtractedFieldsRecord(row.extracted_fields);
  const mergedOverrides = {
    ...parseManualOverridesRecord(row.manual_overrides),
    ...sanitized,
  };
  const effectiveFields = mergeEffectiveFields(extractedFields, mergedOverrides);
  const facets = buildSearchFacets(effectiveFields);
  const searchText = buildSearchText(
    row.raw_pages ?? [],
    effectiveFields,
    row.ai_summary,
    row.technical_highlights ?? [],
  );

  const updated = await updateIntelligenceRow(materialId, {
    manual_overrides: mergedOverrides as unknown as Record<string, unknown>,
    fire_rating: facets.fireRating,
    thickness: facets.thickness,
    finish: facets.finish,
    thermal_value: facets.thermalValue,
    certifications: facets.certifications,
    search_text: searchText,
    reviewed_at: new Date().toISOString(),
  });

  return mapIntelligenceRow(updated);
}

/** Searches materials by datasheet intelligence facets and keywords. */
export async function searchDatasheetIntelligence(
  params: DatasheetIntelligenceSearchParams,
): Promise<DatasheetIntelligenceSearchResult> {
  const supabase = getSupabaseServer();
  if (!supabase) {
    return { items: [], total: 0, page: params.page ?? 1, limit: params.limit ?? 12 };
  }

  const { page, limit, from, to } = normalizePagination(params.page, params.limit, 50);

  let query = supabase
    .from(DB_TABLES.materialDatasheetIntelligence)
    .select(
      `
        material_id,
        fire_rating,
        thickness,
        finish,
        thermal_value,
        certifications,
        ai_summary,
        technical_highlights,
        materials!inner (
          id,
          name,
          slug,
          manufacturer,
          manufacturer_id,
          category,
          image_url,
          is_active
        )
      `,
      { count: "exact" },
    )
    .eq("status", "completed");

  if (params.fireRating?.trim()) {
    query = query.ilike("fire_rating", `%${escapeIlikePattern(params.fireRating.trim())}%`);
  }
  if (params.thickness?.trim()) {
    query = query.ilike("thickness", `%${escapeIlikePattern(params.thickness.trim())}%`);
  }
  if (params.finish?.trim()) {
    query = query.ilike("finish", `%${escapeIlikePattern(params.finish.trim())}%`);
  }
  if (params.thermalValue?.trim()) {
    query = query.ilike(
      "thermal_value",
      `%${escapeIlikePattern(params.thermalValue.trim())}%`,
    );
  }
  if (params.certification?.trim()) {
    query = query.contains("certifications", [params.certification.trim()]);
  }
  if (params.manufacturerId?.trim()) {
    query = query.eq("materials.manufacturer_id", params.manufacturerId.trim());
  } else if (params.manufacturer?.trim()) {
    query = query.ilike(
      "materials.manufacturer",
      `%${escapeIlikePattern(params.manufacturer.trim())}%`,
    );
  }
  if (params.q?.trim()) {
    query = query.ilike("search_text", `%${escapeIlikePattern(params.q.trim())}%`);
  }

  const { data, error, count } = await query
    .order("processed_at", { ascending: false })
    .range(from, to);

  if (error) {
    if (isRangeNotSatisfiableError(error) || isRangeBeyondTotal(from, count ?? 0)) {
      return { items: [], total: count ?? 0, page, limit };
    }
    raiseSupabaseError(error, "searchDatasheetIntelligence");
  }

  const total = count ?? 0;

  const items: DatasheetIntelligenceSearchHit[] = (data ?? [])
    .map((row) => {
      const material = Array.isArray(row.materials) ? row.materials[0] : row.materials;
      if (!material) return null;

      return {
        materialId: material.id,
        materialName: material.name,
        materialSlug: material.slug,
        manufacturer: material.manufacturer,
        category: material.category,
        imageUrl: material.image_url,
        fireRating: row.fire_rating,
        thickness: row.thickness,
        finish: row.finish,
        thermalValue: row.thermal_value,
        certifications: row.certifications ?? [],
        aiSummary: row.ai_summary,
        technicalHighlights: row.technical_highlights ?? [],
      } satisfies DatasheetIntelligenceSearchHit;
    })
    .filter((item): item is DatasheetIntelligenceSearchHit => item !== null);

  return {
    items,
    total,
    page,
    limit,
  };
}

/** Lists intelligence rows for admin review. */
export async function listDatasheetIntelligenceForReview(
  status?: DatasheetIntelligenceStatus,
  limit = 50,
): Promise<DatasheetIntelligence[]> {
  const supabase = getSupabaseServer();
  if (!supabase) return [];

  let query = supabase
    .from(DB_TABLES.materialDatasheetIntelligence)
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) raiseSupabaseError(error, "listDatasheetIntelligenceForReview");

  return ((data ?? []) as MaterialDatasheetIntelligenceRow[]).map(mapIntelligenceRow);
}
