import {
  IMPORT_SCHEDULER_CRON_EXPRESSION,
  IMPORT_SCHEDULER_DAY_OF_MONTH,
  IMPORT_SCHEDULER_FREQUENCY,
  IMPORT_SCHEDULER_HOUR,
  IMPORT_SCHEDULER_SETTINGS_ID,
  IMPORT_SCHEDULER_TIMEZONE,
} from "@/lib/import-scheduler-config";
import { computeNextMonthlyRun } from "@/lib/next-scheduled-run";
import { ServiceError } from "@/lib/errors";
import {
  getSchedulerGlobalState,
  getSchedulerMemorySettings,
  isSchedulerMemoryMode,
  patchSchedulerMemorySettings,
  setSchedulerMemoryMode,
} from "@/lib/scheduler-global-store";
import { getSupabaseServer, isSupabaseConfigured } from "@/lib/supabase";
import type {
  ImportRunTrigger,
  ImportSchedulerProgress,
  ImportSchedulerSettingsRow,
  ImportSchedulerStatus,
} from "@/types/import-scheduler";
import { DB_TABLES } from "@/types/database";
import { countManufacturerImportQueue } from "@/services/manufacturer-registry.service";

function isMissingSchedulerTable(message?: string): boolean {
  return Boolean(
    message?.includes("import_scheduler_settings") &&
      (message.includes("Could not find the table") ||
        message.includes("does not exist")),
  );
}

function isMissingProgressColumn(message?: string): boolean {
  return Boolean(
    message?.includes("run_in_progress") ||
      message?.includes("progress_manufacturer_index") ||
      message?.includes("progress_stage") ||
      message?.includes("schema cache"),
  );
}

function requireSupabase() {
  const supabase = getSupabaseServer();
  if (!supabase) {
    throw new ServiceError(
      "Supabase is not configured.",
      "SUPABASE_NOT_CONFIGURED",
      503,
    );
  }
  return supabase;
}

function normalizeSettingsRow(
  row: Partial<ImportSchedulerSettingsRow>,
): ImportSchedulerSettingsRow {
  const memory = getSchedulerMemorySettings();
  return {
    ...memory,
    ...row,
    id: IMPORT_SCHEDULER_SETTINGS_ID,
  };
}

async function ensureSettingsRow(): Promise<boolean> {
  if (!isSupabaseConfigured() || isSchedulerMemoryMode()) return false;

  const supabase = requireSupabase();
  const { error } = await supabase
    .from(DB_TABLES.importSchedulerSettings)
    .upsert({ id: IMPORT_SCHEDULER_SETTINGS_ID }, { onConflict: "id" });

  if (error) {
    if (isMissingSchedulerTable(error.message)) {
      setSchedulerMemoryMode(true);
      console.warn(
        "[import-scheduler] Database tables missing — using process memory until migration 007 is applied.",
      );
      return false;
    }

    console.error("[import-scheduler] Failed to ensure settings row:", error.message);
    return false;
  }

  return true;
}

async function readSettingsFromDatabase(): Promise<ImportSchedulerSettingsRow | null> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(DB_TABLES.importSchedulerSettings)
    .select("*")
    .eq("id", IMPORT_SCHEDULER_SETTINGS_ID)
    .maybeSingle();

  if (error) {
    if (isMissingSchedulerTable(error.message)) {
      setSchedulerMemoryMode(true);
      return null;
    }

    if (isMissingProgressColumn(error.message)) {
      const { data: legacyData, error: legacyError } = await supabase
        .from(DB_TABLES.importSchedulerSettings)
        .select(
          "id, enabled, frequency, cron_expression, schedule_hour, schedule_day_of_month, timezone, last_successful_run_at, last_failed_run_at, currently_running_manufacturer, last_run_trigger, updated_at",
        )
        .eq("id", IMPORT_SCHEDULER_SETTINGS_ID)
        .maybeSingle();

      if (legacyError || !legacyData) {
        console.error("[import-scheduler] Legacy settings load failed:", legacyError?.message);
        return null;
      }

      return normalizeSettingsRow(legacyData as Partial<ImportSchedulerSettingsRow>);
    }

    console.error("[import-scheduler] Load settings failed:", error.message);
    return null;
  }

  if (!data) return null;
  return normalizeSettingsRow(data as Partial<ImportSchedulerSettingsRow>);
}

async function writeSettingsToDatabase(
  patch: Partial<ImportSchedulerSettingsRow>,
): Promise<ImportSchedulerSettingsRow | null> {
  const updatedAt = new Date().toISOString();
  const supabase = requireSupabase();

  const { data, error } = await supabase
    .from(DB_TABLES.importSchedulerSettings)
    .update({
      ...patch,
      updated_at: updatedAt,
    })
    .eq("id", IMPORT_SCHEDULER_SETTINGS_ID)
    .select()
    .single();

  if (!error && data) {
    return normalizeSettingsRow(data as Partial<ImportSchedulerSettingsRow>);
  }

  if (isMissingSchedulerTable(error?.message)) {
    setSchedulerMemoryMode(true);
    return null;
  }

  if (isMissingProgressColumn(error?.message)) {
    const {
      run_in_progress: _rip,
      progress_manufacturer_index: _pmi,
      progress_manufacturer_total: _pmt,
      progress_imported: _pi,
      progress_updated: _pu,
      progress_skipped: _ps,
      progress_failed: _pf,
      progress_stage: _pst,
      progress_detail: _pd,
      last_run_started_at: _lrs,
      last_run_finished_at: _lrf,
      last_run_duration_seconds: _lrd,
      last_run_imported: _lri,
      last_run_updated: _lru,
      last_run_skipped: _lrs2,
      last_run_failed: _lrf2,
      ...legacyPatch
    } = patch;

    const { data: legacyData, error: legacyError } = await supabase
      .from(DB_TABLES.importSchedulerSettings)
      .update({
        ...legacyPatch,
        updated_at: updatedAt,
      })
      .eq("id", IMPORT_SCHEDULER_SETTINGS_ID)
      .select(
        "id, enabled, frequency, cron_expression, schedule_hour, schedule_day_of_month, timezone, last_successful_run_at, last_failed_run_at, currently_running_manufacturer, last_run_trigger, updated_at",
      )
      .single();

    if (!legacyError && legacyData) {
      return normalizeSettingsRow({
        ...(legacyData as Partial<ImportSchedulerSettingsRow>),
        ...patch,
      });
    }
  }

  if (error) {
    console.error("[import-scheduler] Update settings failed:", error.message);
  }

  return null;
}

export async function getImportSchedulerSettings(): Promise<ImportSchedulerSettingsRow> {
  const memory = getSchedulerMemorySettings();

  if (!isSupabaseConfigured() || isSchedulerMemoryMode()) {
    return memory;
  }

  const dbReady = await ensureSettingsRow();
  if (!dbReady) {
    return memory;
  }

  const fromDb = await readSettingsFromDatabase();
  if (!fromDb) {
    return memory;
  }

  // Never let a stale DB row overwrite an active in-memory run (common when
  // progress columns are missing or polling races the background worker).
  if (memory.run_in_progress && !fromDb.run_in_progress) {
    return memory;
  }

  patchSchedulerMemorySettings(fromDb);
  return fromDb;
}

export async function updateImportSchedulerSettings(
  patch: Partial<ImportSchedulerSettingsRow>,
): Promise<ImportSchedulerSettingsRow> {
  const memoryResult = patchSchedulerMemorySettings(patch);

  if (!isSupabaseConfigured() || isSchedulerMemoryMode()) {
    return memoryResult;
  }

  const dbReady = await ensureSettingsRow();
  if (!dbReady) {
    return memoryResult;
  }

  const fromDb = await writeSettingsToDatabase(patch);
  if (!fromDb) {
    return memoryResult;
  }

  patchSchedulerMemorySettings(fromDb);
  return fromDb;
}

export async function setSchedulerEnabled(enabled: boolean): Promise<void> {
  await updateImportSchedulerSettings({ enabled });
}

export async function beginSchedulerRun(options: {
  trigger: ImportRunTrigger;
  manufacturerTotal: number;
}): Promise<void> {
  const startedAt = new Date().toISOString();

  await updateImportSchedulerSettings({
    run_in_progress: true,
    currently_running_manufacturer: null,
    last_run_trigger: options.trigger,
    last_run_started_at: startedAt,
    last_run_finished_at: null,
    last_run_duration_seconds: null,
    progress_manufacturer_index: 0,
    progress_manufacturer_total: options.manufacturerTotal,
    progress_imported: 0,
    progress_updated: 0,
    progress_skipped: 0,
    progress_failed: 0,
    progress_stage: "scheduler_started",
    progress_detail: `Queued ${options.manufacturerTotal} manufacturer(s)`,
    last_run_imported: 0,
    last_run_updated: 0,
    last_run_skipped: 0,
    last_run_failed: 0,
  });
}

export async function updateSchedulerRunProgress(options: {
  manufacturer: string;
  manufacturerIndex: number;
  manufacturerTotal: number;
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
  stage?: string | null;
  detail?: string | null;
}): Promise<void> {
  await updateImportSchedulerSettings({
    run_in_progress: true,
    currently_running_manufacturer: options.manufacturer,
    progress_manufacturer_index: options.manufacturerIndex,
    progress_manufacturer_total: options.manufacturerTotal,
    progress_imported: options.imported,
    progress_updated: options.updated,
    progress_skipped: options.skipped,
    progress_failed: options.failed,
    progress_stage: options.stage ?? null,
    progress_detail: options.detail ?? null,
  });
}

export async function completeSchedulerRun(options: {
  trigger: ImportRunTrigger;
  hadFailures: boolean;
  durationSeconds: number;
  totals: {
    imported: number;
    updated: number;
    skipped: number;
    failed: number;
  };
}): Promise<void> {
  const finishedAt = new Date().toISOString();

  await updateImportSchedulerSettings({
    run_in_progress: false,
    currently_running_manufacturer: null,
    last_run_trigger: options.trigger,
    last_run_finished_at: finishedAt,
    last_run_duration_seconds: options.durationSeconds,
    last_run_imported: options.totals.imported,
    last_run_updated: options.totals.updated,
    last_run_skipped: options.totals.skipped,
    last_run_failed: options.totals.failed,
    progress_manufacturer_index: 0,
    progress_manufacturer_total: 0,
    progress_imported: options.totals.imported,
    progress_updated: options.totals.updated,
    progress_skipped: options.totals.skipped,
    progress_failed: options.totals.failed,
    progress_stage: "scheduler_completed",
    progress_detail: `Finished in ${options.durationSeconds}s`,
    ...(options.hadFailures
      ? { last_failed_run_at: finishedAt }
      : { last_successful_run_at: finishedAt }),
  });
}

export async function clearSchedulerRunState(): Promise<void> {
  await updateImportSchedulerSettings({
    run_in_progress: false,
    currently_running_manufacturer: null,
  });
}

export function isSchedulerRunActive(): boolean {
  const settings = getSchedulerMemorySettings();
  return Boolean(settings.run_in_progress || getSchedulerGlobalState().activeRun);
}

function formatScheduleDescription(settings: ImportSchedulerSettingsRow): string {
  const hour = String(settings.schedule_hour).padStart(2, "0");
  return `Day ${settings.schedule_day_of_month} of every month at ${hour}:00 ${settings.timezone}`;
}

function buildProgress(settings: ImportSchedulerSettingsRow): ImportSchedulerProgress | null {
  if (!settings.run_in_progress) return null;

  const crawledPagesMatch = settings.progress_detail?.match(/(\d+)\s+page/i);

  return {
    manufacturerIndex: settings.progress_manufacturer_index,
    manufacturerTotal: settings.progress_manufacturer_total,
    currentManufacturer: settings.currently_running_manufacturer,
    imported: settings.progress_imported,
    updated: settings.progress_updated,
    skipped: settings.progress_skipped,
    failed: settings.progress_failed,
    stage: settings.progress_stage,
    detail: settings.progress_detail,
    crawledPages: crawledPagesMatch ? Number(crawledPagesMatch[1]) : null,
  };
}

export async function getImportSchedulerStatus(): Promise<ImportSchedulerStatus> {
  const [settings, enabledManufacturerCount] = await Promise.all([
    getImportSchedulerSettings(),
    countManufacturerImportQueue({ frequency: IMPORT_SCHEDULER_FREQUENCY }),
  ]);

  const nextRun = computeNextMonthlyRun(
    new Date(),
    settings.schedule_hour,
    settings.schedule_day_of_month,
  );

  return {
    enabled: settings.enabled,
    frequency: settings.frequency,
    cronExpression: settings.cron_expression,
    scheduleDescription: formatScheduleDescription(settings),
    timezone: settings.timezone,
    nextScheduledRunAt: nextRun.toISOString(),
    lastSuccessfulRunAt: settings.last_successful_run_at,
    lastFailedRunAt: settings.last_failed_run_at,
    currentlyRunningManufacturer: settings.currently_running_manufacturer,
    enabledManufacturerCount,
    isRunning: Boolean(settings.run_in_progress || settings.currently_running_manufacturer),
    runInProgress: Boolean(settings.run_in_progress),
    progress: buildProgress(settings),
    lastRun: {
      startedAt: settings.last_run_started_at,
      finishedAt: settings.last_run_finished_at,
      durationSeconds: settings.last_run_duration_seconds,
      imported: settings.last_run_imported,
      updated: settings.last_run_updated,
      skipped: settings.last_run_skipped,
      failed: settings.last_run_failed,
      trigger: settings.last_run_trigger,
    },
  };
}

// Backwards-compatible helpers used by the orchestrator.
export async function setCurrentlyRunningManufacturer(
  manufacturer: string | null,
): Promise<void> {
  await updateImportSchedulerSettings({
    currently_running_manufacturer: manufacturer,
    run_in_progress: manufacturer !== null,
  });
}

export async function recordSchedulerRunOutcome(options: {
  trigger: ImportRunTrigger;
  hadFailures: boolean;
  durationSeconds?: number;
  totals?: {
    imported: number;
    updated: number;
    skipped: number;
    failed: number;
  };
}): Promise<void> {
  await completeSchedulerRun({
    trigger: options.trigger,
    hadFailures: options.hadFailures,
    durationSeconds: options.durationSeconds ?? 0,
    totals: options.totals ?? {
      imported: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
    },
  });
}
