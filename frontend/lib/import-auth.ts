import type { NextRequest } from "next/server";
import { env } from "@/lib/env";

/**
 * Validates the import cron secret for automated triggers (Vercel Cron, n8n).
 * When IMPORT_CRON_SECRET is unset, requests are allowed (local development).
 */
export function isImportCronAuthorized(request: NextRequest): boolean {
  const secret = env.IMPORT_CRON_SECRET;
  if (!secret) return true;

  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;

  const cronHeader = request.headers.get("x-cron-secret");
  if (cronHeader === secret) return true;

  const querySecret = request.nextUrl.searchParams.get("secret");
  return querySecret === secret;
}
