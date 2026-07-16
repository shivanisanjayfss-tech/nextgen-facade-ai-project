import { getSupabaseServer, isSupabaseConfigured } from "@/lib/supabase";
import { DB_TABLES } from "@/types/database";

export type AnalyticsEventName =
  | "search"
  | "compare"
  | "material_view"
  | "datasheet_view"
  | "manufacturer_view"
  | "import_run";

export interface LogAnalyticsEventInput {
  eventName: AnalyticsEventName;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

let analyticsTableMissing = false;

function isMissingAnalyticsTable(message?: string): boolean {
  return Boolean(
    message?.includes("analytics_events") &&
      (message.includes("Could not find the table") ||
        message.includes("does not exist")),
  );
}

/** Fire-and-forget analytics event logging. Never throws to callers. */
export async function logAnalyticsEvent(
  input: LogAnalyticsEventInput,
): Promise<void> {
  if (!isSupabaseConfigured() || analyticsTableMissing) return;

  const supabase = getSupabaseServer();
  if (!supabase) return;

  const { error } = await supabase.from(DB_TABLES.analyticsEvents).insert({
    event_name: input.eventName,
    user_id: input.userId ?? null,
    session_id: input.sessionId ?? null,
    metadata: input.metadata ?? {},
  });

  if (error) {
    if (isMissingAnalyticsTable(error.message)) {
      analyticsTableMissing = true;
      console.warn(
        "[analytics] Table missing — events will be skipped until migration 013 is applied.",
      );
      return;
    }

    console.error("[analytics] Failed to log event:", error.message);
  }
}

export interface AnalyticsSummary {
  totalEvents: number;
  byEvent: Record<string, number>;
}

/** Returns lightweight analytics totals for the admin dashboard. */
export async function getAnalyticsSummary(
  days = 30,
): Promise<AnalyticsSummary> {
  if (!isSupabaseConfigured() || analyticsTableMissing) {
    return { totalEvents: 0, byEvent: {} };
  }

  const supabase = getSupabaseServer();
  if (!supabase) {
    return { totalEvents: 0, byEvent: {} };
  }

  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from(DB_TABLES.analyticsEvents)
    .select("event_name")
    .gte("created_at", since.toISOString());

  if (error) {
    if (isMissingAnalyticsTable(error.message)) {
      analyticsTableMissing = true;
      return { totalEvents: 0, byEvent: {} };
    }

    console.error("[analytics] Summary failed:", error.message);
    return { totalEvents: 0, byEvent: {} };
  }

  const byEvent: Record<string, number> = {};
  for (const row of data ?? []) {
    const name = (row as { event_name: string }).event_name;
    byEvent[name] = (byEvent[name] ?? 0) + 1;
  }

  return {
    totalEvents: data?.length ?? 0,
    byEvent,
  };
}
