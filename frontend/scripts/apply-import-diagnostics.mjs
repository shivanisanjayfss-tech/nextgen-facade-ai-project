/**
 * Applies import diagnostics persistence migration against Supabase Postgres.
 *
 * Usage:
 *   npm run db:apply-import-diagnostics
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

const PROJECT_REF = "ieyuzvqyeaoduavwefgr";
const MIGRATION_FILE = join(
  rootDir,
  "supabase",
  "migrations",
  "022_import_diagnostics.sql",
);

function loadEnvLocal() {
  const envPath = join(rootDir, ".env.local");
  if (!existsSync(envPath)) return;

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
    if (!process.env[key]) process.env[key] = value;
  }
}

function parseArgs(argv) {
  const args = { dbUrl: "", password: "" };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--db-url" || arg === "--database-url") {
      args.dbUrl = argv[i + 1] ?? "";
      i += 1;
    } else if (arg.startsWith("--db-url=")) {
      args.dbUrl = arg.slice("--db-url=".length);
    } else if (arg === "--password" || arg === "-p") {
      args.password = argv[i + 1] ?? "";
      i += 1;
    } else if (arg.startsWith("--password=")) {
      args.password = arg.slice("--password=".length);
    }
  }
  return args;
}

function resolveDbUrl(args) {
  if (args.dbUrl.trim()) return args.dbUrl.trim();

  const fromEnv = (
    process.env.SUPABASE_DB_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DIRECT_URL ||
    ""
  ).trim();
  if (fromEnv) return fromEnv;

  const password = (
    args.password ||
    process.env.SUPABASE_DB_PASSWORD ||
    ""
  ).trim();

  if (password) {
    const encoded = encodeURIComponent(password);
    return `postgresql://postgres:${encoded}@db.${PROJECT_REF}.supabase.co:5432/postgres`;
  }

  return "";
}

async function main() {
  loadEnvLocal();
  const args = parseArgs(process.argv.slice(2));
  const dbUrl = resolveDbUrl(args);

  if (!dbUrl) {
    console.error(
      [
        "Missing database credentials.",
        "",
        "Provide one of:",
        "  1) SUPABASE_DB_URL in frontend/.env.local",
        "  2) node scripts/apply-import-diagnostics.mjs --password \"YOUR_DB_PASSWORD\"",
        "",
        `Project ref: ${PROJECT_REF}`,
        "",
        "Prerequisite: migration 021 (import_scheduler_bootstrap) should be applied first.",
      ].join("\n"),
    );
    process.exit(1);
  }

  let pg;
  try {
    pg = require("pg");
  } catch {
    console.error('Package "pg" is required. Run: npm install pg');
    process.exit(1);
  }

  const sql = readFileSync(MIGRATION_FILE, "utf8");
  const client = new pg.Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });

  console.log("Connecting to Supabase Postgres…");
  await client.connect();

  try {
    console.log("Applying 022_import_diagnostics.sql …");
    await client.query(sql);

    const { rows } = await client.query(`
      SELECT
        EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'import_scheduler_runs'
        ) AS scheduler_runs_table,
        EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'import_run_events'
        ) AS run_events_table,
        (
          SELECT COUNT(*)::INTEGER
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'import_history'
            AND column_name = 'diagnostics'
        ) AS history_diagnostics_column
    `);

    const stats = rows[0];
    console.log("\nMigration report:");
    console.log(`  import_scheduler_runs: ${stats.scheduler_runs_table ? "yes" : "no"}`);
    console.log(`  import_run_events: ${stats.run_events_table ? "yes" : "no"}`);
    console.log(`  import_history.diagnostics: ${stats.history_diagnostics_column ? "yes" : "no"}`);
    console.log("\nImport diagnostics migration applied successfully.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Migration failed:", error.message ?? error);
  process.exit(1);
});
