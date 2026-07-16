import {
  IMPORT_SCHEDULER_DAY_OF_MONTH,
  IMPORT_SCHEDULER_HOUR,
} from "@/lib/import-scheduler-config";

/**
 * Returns the next monthly run at the configured day/hour in UTC.
 * Used for the admin scheduler panel "Next Scheduled Run" display.
 */
export function computeNextMonthlyRun(
  referenceDate: Date = new Date(),
  hour = IMPORT_SCHEDULER_HOUR,
  dayOfMonth = IMPORT_SCHEDULER_DAY_OF_MONTH,
): Date {
  const year = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth();

  let candidate = new Date(Date.UTC(year, month, dayOfMonth, hour, 0, 0, 0));

  if (candidate.getTime() <= referenceDate.getTime()) {
    candidate = new Date(Date.UTC(year, month + 1, dayOfMonth, hour, 0, 0, 0));
  }

  return candidate;
}
