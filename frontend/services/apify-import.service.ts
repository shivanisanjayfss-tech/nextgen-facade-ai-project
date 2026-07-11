import {
  getDatasetItems,
  runActor,
  type ApifyActorRun,
} from "@/lib/apify";
import { ServiceError } from "@/lib/errors";
import { env, isApifyConfigured } from "@/lib/env";
import type { ImportedMaterialData, MaterialImportResult } from "@/types/import";
import type { MaterialCategory } from "@/types";

const DEFAULT_IMPORT_TIMEOUT_MS = 300_000;

const MATERIAL_CATEGORIES: MaterialCategory[] = [
  "ACP",
  "Glass",
  "Stone",
  "HPL",
  "Louvers",
  "Metal",
  "Composite",
  "Other",
];

export interface RunMaterialImportOptions {
  /** Apify Actor ID (e.g. `user~actor-name`). Falls back to APIFY_MATERIALS_ACTOR_ID. */
  actorId?: string;
  /** Actor input payload — forwarded as-is to Apify. */
  input?: Record<string, unknown>;
  /** Wait for the Actor run to finish before reading dataset items. Default: true. */
  waitForFinish?: boolean;
  /** Max wait time when waitForFinish is true. Default: 5 minutes. */
  timeoutMs?: number;
  /** Poll interval while waiting for run completion. Default: 5 seconds. */
  pollIntervalMs?: number;
}

function resolveActorId(actorId?: string): string {
  const resolved = actorId ?? env.APIFY_MATERIALS_ACTOR_ID;
  if (!resolved) {
    throw new ServiceError(
      "Apify Actor ID is required. Pass actorId or set APIFY_MATERIALS_ACTOR_ID in .env.local.",
      "MISSING_ACTOR_ID",
      400,
    );
  }

  return resolved;
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return undefined;
}

function normalizeCategory(value: unknown): string {
  const raw = asString(value);
  if (!raw) return "Other";

  const match = MATERIAL_CATEGORIES.find(
    (category) => category.toLowerCase() === raw.toLowerCase(),
  );

  return match ?? "Other";
}

function normalizeSpecs(value: unknown): Record<string, string | undefined> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const specs: Record<string, string | undefined> = {};

  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (raw === null || raw === undefined) continue;

    if (Array.isArray(raw)) {
      specs[key] = raw.map((item) => asString(item)).filter(Boolean).join(", ");
      continue;
    }

    const normalized = asString(raw);
    if (normalized) {
      specs[key] = normalized;
    }
  }

  return specs;
}

/** Maps a raw Apify dataset item to normalized import-ready material data. */
export function mapApifyItemToImportedMaterial(
  item: Record<string, unknown>,
): ImportedMaterialData | null {
  const name =
    asString(item.name) ??
    asString(item.title) ??
    asString(item.material_name) ??
    asString(item.materialName);

  if (!name) return null;

  const manufacturer =
    asString(item.manufacturer) ??
    asString(item.brand) ??
    asString(item.supplier) ??
    "Unknown";

  const description =
    asString(item.description) ??
    asString(item.summary) ??
    asString(item.details) ??
    "";

  const specsSource =
    item.specs ??
    item.specifications ??
    item.technical_specs ??
    item.technicalSpecs ??
    item.properties;

  const datasheet_url =
    asString(item.datasheet_url) ??
    asString(item.datasheetUrl) ??
    asString(item.pdf_url) ??
    asString(item.pdfUrl) ??
    asString(item.document_url) ??
    asString(item.documentUrl);

  return {
    name,
    manufacturer,
    category: normalizeCategory(item.category ?? item.type ?? item.material_type),
    description,
    specs: normalizeSpecs(specsSource),
    ...(datasheet_url ? { datasheet_url } : {}),
  };
}

function toImportResult(
  run: ApifyActorRun,
  actorId: string,
  materials: ImportedMaterialData[],
): MaterialImportResult {
  return {
    run_id: run.id,
    dataset_id: run.defaultDatasetId,
    actor_id: actorId,
    status: run.status,
    started_at: run.startedAt,
    finished_at: run.finishedAt,
    item_count: materials.length,
    materials,
  };
}

/**
 * Runs an Apify Actor and returns normalized facade material records.
 * Designed for one-off imports and future scheduled/cron execution.
 */
export async function runMaterialImport(
  options: RunMaterialImportOptions = {},
): Promise<MaterialImportResult> {
  if (!isApifyConfigured()) {
    throw new ServiceError(
      "APIFY_API_TOKEN is not configured. Add it to .env.local.",
      "MISSING_API_KEY",
      503,
    );
  }

  const actorId = resolveActorId(options.actorId);
  const waitForFinish = options.waitForFinish ?? true;

  const run = await runActor(actorId, options.input ?? {}, {
    waitForFinish,
    timeoutMs: options.timeoutMs ?? DEFAULT_IMPORT_TIMEOUT_MS,
    pollIntervalMs: options.pollIntervalMs,
  });

  if (run.status !== "SUCCEEDED") {
    throw new ServiceError(
      `Apify run "${run.id}" finished with status ${run.status}.${run.statusMessage ? ` ${run.statusMessage}` : ""}`,
      "APIFY_RUN_FAILED",
      502,
    );
  }

  const rawItems = await getDatasetItems<Record<string, unknown>>(run.defaultDatasetId);
  const materials = rawItems
    .map(mapApifyItemToImportedMaterial)
    .filter((item): item is ImportedMaterialData => item !== null);

  return toImportResult(run, actorId, materials);
}

/**
 * Reads dataset items from a completed Apify run without starting a new Actor.
 * Useful when a scheduled job only needs to process an existing dataset.
 */
export async function importMaterialsFromRun(
  run: Pick<ApifyActorRun, "id" | "defaultDatasetId" | "status" | "startedAt" | "finishedAt">,
  actorId: string,
): Promise<MaterialImportResult> {
  if (run.status !== "SUCCEEDED") {
    throw new ServiceError(
      `Cannot import materials from run "${run.id}" with status ${run.status}.`,
      "APIFY_RUN_FAILED",
      502,
    );
  }

  const rawItems = await getDatasetItems<Record<string, unknown>>(run.defaultDatasetId);
  const materials = rawItems
    .map(mapApifyItemToImportedMaterial)
    .filter((item): item is ImportedMaterialData => item !== null);

  return toImportResult(run as ApifyActorRun, actorId, materials);
}
