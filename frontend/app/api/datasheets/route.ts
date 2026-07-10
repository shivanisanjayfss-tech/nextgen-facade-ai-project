import { apiError, apiSuccess } from "@/lib/api-response";
import { getDatasheets } from "@/services/datasheet.service";

/** GET /api/datasheets — List all technical datasheets. */
export async function GET() {
  try {
    const datasheets = await getDatasheets();
    return apiSuccess(datasheets);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch datasheets";
    return apiError(message, 500, "DATASHEET_ERROR");
  }
}
