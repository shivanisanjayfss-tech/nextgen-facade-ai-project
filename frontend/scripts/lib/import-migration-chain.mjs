/**
 * Shared helpers for applying import-related SQL migrations in order.
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
export const rootDir = join(__dirname, "..");
export const PROJECT_REF = "ieyuzvqyeaoduavwefgr";

export const IMPORT_MIGRATION_CHAIN = [
  {
    id: "020a",
    file: "020a_import_history_baseline.sql",
    label: "import history baseline",
  },
  {
    id: "021",
    file: "021_import_scheduler_bootstrap.sql",
    label: "import scheduler bootstrap",
  },
  {
    id: "022",
    file: "022_import_diagnostics.sql",
    label: "import diagnostics",
  },
];

export function loadEnvLocal() {
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

export function parseDbArgs(argv) {
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

export function resolveDbUrl(args) {
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

export function readMigrationSql(filename) {
  return readFileSync(join(rootDir, "supabase", "migrations", filename), "utf8");
}

export function createPgClient(dbUrl) {
  let pg;
  try {
    pg = require("pg");
  } catch {
    throw new Error('Package "pg" is required. Run: npm install pg');
  }

  return new pg.Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });
}

export async function applyMigrationFiles(client, files) {
  for (const file of files) {
    const entry = IMPORT_MIGRATION_CHAIN.find((migration) => migration.file === file);
    const label = entry?.label ?? file;
    console.log(`Applying ${file} (${label})…`);
    await client.query(readMigrationSql(file));
  }
}

export function printMissingDbCredentials(extraLines = []) {
  console.error(
    [
      "Missing database credentials.",
      "",
      "Provide one of:",
      "  1) SUPABASE_DB_URL in frontend/.env.local",
      '  2) node scripts/apply-import-migration-chain.mjs --password "YOUR_DB_PASSWORD"',
      "",
      `Project ref: ${PROJECT_REF}`,
      ...extraLines,
    ].join("\n"),
  );
}
