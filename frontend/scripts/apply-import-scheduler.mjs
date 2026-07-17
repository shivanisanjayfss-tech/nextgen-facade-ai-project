/**
 * Applies import scheduler bootstrap migration (020a + 021).
 *
 * Usage:
 *   npm run db:apply-import-scheduler
 */

import {
  applyMigrationFiles,
  createPgClient,
  loadEnvLocal,
  parseDbArgs,
  printMissingDbCredentials,
  resolveDbUrl,
} from "./lib/import-migration-chain.mjs";

async function main() {
  loadEnvLocal();
  const args = parseDbArgs(process.argv.slice(2));
  const dbUrl = resolveDbUrl(args);

  if (!dbUrl) {
    printMissingDbCredentials([
      "",
      "Applies:",
      "  020a_import_history_baseline.sql",
      "  021_import_scheduler_bootstrap.sql",
    ]);
    process.exit(1);
  }

  const client = createPgClient(dbUrl);
  console.log("Connecting to Supabase Postgres…");
  await client.connect();

  try {
    await applyMigrationFiles(client, [
      "020a_import_history_baseline.sql",
      "021_import_scheduler_bootstrap.sql",
    ]);

    const { rows } = await client.query(`
      SELECT
        EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'import_scheduler_settings'
        ) AS scheduler_table_exists,
        EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'import_history'
        ) AS history_table_exists,
        (
          SELECT COUNT(*)::INTEGER
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'import_scheduler_settings'
            AND column_name = 'run_in_progress'
        ) AS progress_columns,
        (
          SELECT COUNT(*)::INTEGER
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'import_history'
            AND column_name = 'product_decisions'
        ) AS history_product_decisions_column
    `);

    const stats = rows[0];
    console.log("\nMigration report:");
    console.log(`  import_history: ${stats.history_table_exists ? "yes" : "no"}`);
    console.log(`  import_scheduler_settings: ${stats.scheduler_table_exists ? "yes" : "no"}`);
    console.log(`  progress columns: ${stats.progress_columns}`);
    console.log(`  import_history.product_decisions: ${stats.history_product_decisions_column ? "yes" : "no"}`);
    console.log("\nImport scheduler bootstrap applied successfully.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Migration failed:", error.message ?? error);
  process.exit(1);
});
