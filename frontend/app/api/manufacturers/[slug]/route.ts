import { NextRequest } from "next/server";
import { apiError, apiSuccess, withApiHandler } from "@/lib/api-response";
import { logAnalyticsEvent } from "@/services/analytics.service";
import { getManufacturerProfile } from "@/services/manufacturer-profile.service";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

/**
 * GET /api/manufacturers/[slug]
 *
 * Returns a dynamic manufacturer profile with products and import metadata.
 */
export const GET = withApiHandler(async (
  _request: NextRequest,
  context?: RouteContext,
) => {
  const { slug } = await context!.params;
  const profile = await getManufacturerProfile(slug);

  if (!profile) {
    return apiError("Manufacturer not found.", 404, "MANUFACTURER_NOT_FOUND");
  }

  void logAnalyticsEvent({
    eventName: "manufacturer_view",
    metadata: { slug: profile.slug, name: profile.name },
  });

  return apiSuccess({ profile });
});
