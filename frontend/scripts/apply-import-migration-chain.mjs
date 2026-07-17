/**
 * Applies the full import migration chain in the required order:
 *   020a_import_history_baseline.sql
 *   021_import_scheduler_bootstrap.sql
 *   022_import_diagnostics.sql
 *
 * Usage:
 *   npm run db:apply-import-chain
 */

import {
  IMPORT_MIGRATION_CHAIN,
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
      "This script applies, in order:",
      "  020a_import_history_baseline.sql",
      "  021_import_scheduler_bootstrap.sql",
      "  022_import_diagnostics.sql",
    ]);
    process.exit(1);
  }

  const client = createPgClient(dbUrl);
  console.log("Connecting to Supabase Postgres…");
  await client.connect();

  try {
    await applyMigrationFiles(
      client,
      IMPORT_MIGRATION_CHAIN.map((migration) => migration.file),
    );

    const { rows } = await client.query(`
      SELECT
        EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'import_history'
        ) AS history_table,
        EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'import_scheduler_settings'
        ) AS scheduler_table,
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
    console.log(`  import_history: ${stats.history_table ? "yes" : "no"}`);
    console.log(`  import_scheduler_settings: ${stats.scheduler_table ? "yes" : "no"}`);
    console.log(`  import_scheduler_runs: ${stats.scheduler_runs_table ? "yes" : "no"}`);
    console.log(`  import_run_events: ${stats.run_events_table ? "yes" : "no"}`);
    console.log(`  import_history.diagnostics: ${stats.history_diagnostics_column ? "yes" : "no"}`);
    console.log("\nImport migration chain applied successfully.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Migration chain failed:", error.message ?? error);
  process.exit(1);
});
