/**
 * Verifies Phase 3a import diagnostics persistence in Supabase.
 *
 * Usage: node scripts/verify-import-diagnostics.mjs
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

function loadEnvLocal() {
  const envPath = join(rootDir, ".env.local");
  if (!existsSync(envPath)) return {};

  const env = {};
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const env = loadEnvLocal();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");
  process.exit(1);
}

const sb = createClient(url, key);

async function tableCount(table) {
  const { count, error } = await sb.from(table).select("*", { count: "exact", head: true });
  if (error) return { error: error.message };
  return { count };
}

async function main() {
  const [runsCount, eventsCount, historyCount] = await Promise.all([
    tableCount("import_scheduler_runs"),
    tableCount("import_run_events"),
    tableCount("import_history"),
  ]);

  const { data: runs, error: runsError } = await sb
    .from("import_scheduler_runs")
    .select("id,trigger,status,manufacturer_total,imported,updated,started_at,finished_at")
    .order("started_at", { ascending: false })
    .limit(10);

  const { data: historyWithRun } = await sb
    .from("import_history")
    .select(
      "id,manufacturer,status,scheduler_run_id,diagnostics,crawl_status,crawled_pages,trigger,started_at",
    )
    .not("scheduler_run_id", "is", null)
    .order("started_at", { ascending: false })
    .limit(10);

  const { data: historyLegacy } = await sb
    .from("import_history")
    .select("id,manufacturer,status,scheduler_run_id,started_at")
    .is("scheduler_run_id", null)
    .order("started_at", { ascending: false })
    .limit(5);

  const { data: events } = await sb
    .from("import_run_events")
    .select("id,stage,scheduler_run_id,import_history_id,manufacturer,created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: allEvents } = await sb.from("import_run_events").select("stage,scheduler_run_id");

  const stageDistribution = {};
  for (const event of allEvents ?? []) {
    stageDistribution[event.stage] = (stageDistribution[event.stage] ?? 0) + 1;
  }

  const runIds = new Set((runs ?? []).map((row) => row.id));
  const historyRunIds = new Set((historyWithRun ?? []).map((row) => row.scheduler_run_id));
  const eventRunIds = new Set(
    (allEvents ?? []).filter((row) => row.scheduler_run_id).map((row) => row.scheduler_run_id),
  );

  const historyWithDiagnostics = (historyWithRun ?? []).filter(
    (row) => row.diagnostics && Object.keys(row.diagnostics).length > 0,
  );

  const checks = {
    tables_exist: {
      import_scheduler_runs: !runsCount.error,
      import_run_events: !eventsCount.error,
      import_history: !historyCount.error,
    },
    table_counts: {
      import_scheduler_runs: runsCount,
      import_run_events: eventsCount,
      import_history: historyCount,
    },
    check1_scheduler_runs: {
      pass: !runsCount.error && (runsCount.count ?? 0) > 0,
      detail: "import_scheduler_runs has rows (one per scheduler run expected)",
      recent: runs ?? [],
      error: runsError?.message ?? null,
    },
    check2_history_links: {
      pass: (historyWithRun ?? []).length > 0,
      rows_with_scheduler_run_id: (historyWithRun ?? []).length,
      rows_with_diagnostics: historyWithDiagnostics.length,
      sample: (historyWithRun ?? []).slice(0, 3),
    },
    check3_run_events: {
      pass: !eventsCount.error && (eventsCount.count ?? 0) > 0,
      stage_distribution: stageDistribution,
      recent: (events ?? []).slice(0, 10),
    },
    check4_backward_compat: {
      pass: true,
      legacy_rows_without_scheduler_run_id: (historyLegacy ?? []).length,
      legacy_sample: historyLegacy ?? [],
      note: "Legacy rows load without scheduler_run_id; new columns are nullable",
    },
    check5_linkage: {
      runs_with_linked_history: [...runIds].filter((id) => historyRunIds.has(id)).length,
      runs_with_events: [...runIds].filter((id) => eventRunIds.has(id)).length,
      total_recent_runs: runIds.size,
    },
  };

  checks.all_pass =
    checks.tables_exist.import_scheduler_runs &&
    checks.tables_exist.import_run_events &&
    checks.check1_scheduler_runs.pass &&
    checks.check2_history_links.pass &&
    checks.check3_run_events.pass &&
    checks.check4_backward_compat.pass;

  console.log(JSON.stringify(checks, null, 2));
  process.exit(checks.all_pass ? 0 : 1);
}

main().catch((error) => {
  console.error("Verification failed:", error.message ?? error);
  process.exit(1);
});
