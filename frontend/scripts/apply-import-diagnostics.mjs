/**
 * Applies import diagnostics persistence migration (full chain: 020a → 021 → 022).
 *
 * Usage:
 *   npm run db:apply-import-diagnostics
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
      "Applies, in order:",
      ...IMPORT_MIGRATION_CHAIN.map((migration) => `  ${migration.file}`),
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
          WHERE table_schema = 'public' AND table_name = 'import_scheduler_runs'
        ) AS scheduler_runs_table,
        EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'import_run_events'
        ) AS run_events_table,
        EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'import_history'
        ) AS history_table,
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
