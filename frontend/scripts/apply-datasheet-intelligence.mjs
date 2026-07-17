/**
 * Applies Phase 4 datasheet intelligence migration (023).
 *
 * Usage:
 *   npm run db:apply-datasheet-intelligence
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATION_FILE = "023_datasheet_intelligence.sql";

function loadEnvLocal() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function resolveDbUrl() {
  return (
    process.env.SUPABASE_DB_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    null
  );
}

async function main() {
  loadEnvLocal();
  const dbUrl = resolveDbUrl();

  if (!dbUrl) {
    console.error("Missing database URL. Set SUPABASE_DB_URL or DATABASE_URL in .env.local");
    process.exit(1);
  }

  const sqlPath = path.join(__dirname, "..", "supabase", "migrations", MIGRATION_FILE);
  const sql = fs.readFileSync(sqlPath, "utf8");
  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

  console.log(`Applying ${MIGRATION_FILE}…`);
  await client.connect();

  try {
    await client.query(sql);

    const { rows } = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'material_datasheet_intelligence'
      ) AS table_exists,
      (
        SELECT COUNT(*)::INTEGER
        FROM material_datasheet_intelligence
      ) AS row_count
    `);

    console.log("Migration applied successfully.");
    console.log(rows[0]);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
