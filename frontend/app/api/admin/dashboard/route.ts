import { apiSuccess } from "@/lib/api-response";
import { IMPORT_SCHEDULER_FREQUENCY } from "@/lib/import-scheduler-config";
import { getAnalyticsSummary } from "@/services/analytics.service";
import {
  countManufacturerImportQueue,
  listManufacturerRegistry,
} from "@/services/manufacturer-registry.service";
import { listImportHistory } from "@/services/import-history.service";
import { getSupabaseServer } from "@/lib/supabase";
import { DB_TABLES } from "@/types/database";

async function countTotalProducts(): Promise<number> {
  const supabase = getSupabaseServer();
  if (!supabase) return 0;

  const { count, error } = await supabase
    .from(DB_TABLES.materials)
    .select("*", { count: "exact", head: true });

  if (error) return 0;
  return count ?? 0;
}

/**
 * GET /api/admin/dashboard
 *
 * Admin dashboard metrics and full manufacturer registry for automatic imports.
 */
export async function GET() {
  const [analytics, queueCount, history, manufacturers, totalProducts] =
    await Promise.all([
      getAnalyticsSummary(30),
      countManufacturerImportQueue({ frequency: IMPORT_SCHEDULER_FREQUENCY }),
      listImportHistory(50).catch(() => []),
      listManufacturerRegistry(),
      countTotalProducts(),
    ]);

  const recentImports = history.slice(0, 10);
  const failedImports = history.filter((row) => row.status === "failed").length;
  const updatedProducts = history.reduce((sum, row) => sum + row.updated, 0);

  return apiSuccess({
    metrics: {
      manufacturersInQueue: queueCount,
      totalManufacturers: manufacturers.length,
      totalProducts,
      failedImports,
      updatedProducts,
      analyticsEvents30d: analytics.totalEvents,
      analyticsByEvent: analytics.byEvent,
    },
    manufacturers,
    recentImports,
  });
}
