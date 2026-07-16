import type { ImportSchedulerSettingsRow } from "@/types/import-scheduler";

interface SchedulerGlobalState {
  settings: ImportSchedulerSettingsRow;
  useMemoryStore: boolean;
  activeRun: Promise<unknown> | null;
}

const STORE_KEY = "__nextgenImportSchedulerStore__";

function createDefaultSettings(): ImportSchedulerSettingsRow {
  return {
    id: "default",
    enabled: true,
    frequency: "monthly",
    cron_expression: "0 2 1 * *",
    schedule_hour: 2,
    schedule_day_of_month: 1,
    timezone: "UTC",
    last_successful_run_at: null,
    last_failed_run_at: null,
    currently_running_manufacturer: null,
    last_run_trigger: null,
    updated_at: new Date().toISOString(),
    run_in_progress: false,
    progress_manufacturer_index: 0,
    progress_manufacturer_total: 0,
    progress_imported: 0,
    progress_updated: 0,
    progress_skipped: 0,
    progress_failed: 0,
    last_run_started_at: null,
    last_run_finished_at: null,
    last_run_duration_seconds: null,
    last_run_imported: 0,
    last_run_updated: 0,
    last_run_skipped: 0,
    last_run_failed: 0,
  };
}

export function getSchedulerGlobalState(): SchedulerGlobalState {
  const root = globalThis as typeof globalThis & {
    [STORE_KEY]?: SchedulerGlobalState;
  };

  if (!root[STORE_KEY]) {
    root[STORE_KEY] = {
      settings: createDefaultSettings(),
      useMemoryStore: false,
      activeRun: null,
    };
  }

  return root[STORE_KEY];
}

export function getSchedulerMemorySettings(): ImportSchedulerSettingsRow {
  return getSchedulerGlobalState().settings;
}

export function patchSchedulerMemorySettings(
  patch: Partial<ImportSchedulerSettingsRow>,
): ImportSchedulerSettingsRow {
  const store = getSchedulerGlobalState();
  store.settings = {
    ...store.settings,
    ...patch,
    updated_at: new Date().toISOString(),
  };
  return store.settings;
}

export function isSchedulerMemoryMode(): boolean {
  return getSchedulerGlobalState().useMemoryStore;
}

export function setSchedulerMemoryMode(enabled: boolean): void {
  getSchedulerGlobalState().useMemoryStore = enabled;
}

export function getActiveSchedulerRun(): Promise<unknown> | null {
  return getSchedulerGlobalState().activeRun;
}

export function setActiveSchedulerRun(run: Promise<unknown> | null): void {
  getSchedulerGlobalState().activeRun = run;
}
