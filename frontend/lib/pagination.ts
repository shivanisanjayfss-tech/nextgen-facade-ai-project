export interface NormalizedPagination {
  page: number;
  limit: number;
  from: number;
  to: number;
}

/** Normalizes page/limit and derives an inclusive Supabase range. */
export function normalizePagination(
  page?: number,
  limit?: number,
  maxLimit = 50,
): NormalizedPagination {
  const parsedPage = Number(page);
  const parsedLimit = Number(limit);

  const safePage = Math.max(1, Number.isFinite(parsedPage) ? Math.floor(parsedPage) : 1);
  const rawLimit = Number.isFinite(parsedLimit) ? Math.floor(parsedLimit) : 12;
  const safeLimit = Math.min(Math.max(1, rawLimit), maxLimit);
  const from = (safePage - 1) * safeLimit;
  const to = from + safeLimit - 1;

  return { page: safePage, limit: safeLimit, from, to };
}

/** True when the requested offset starts beyond the available row count. */
export function isRangeBeyondTotal(from: number, total: number): boolean {
  return total <= 0 || from >= total;
}

/** True when the inclusive range window is invalid for the available row count. */
export function isInvalidRangeWindow(
  from: number,
  to: number,
  total: number,
): boolean {
  return isRangeBeyondTotal(from, total) || to < from;
}

/** Clamps the inclusive range end so Supabase never receives an invalid window. */
export function clampRangeEnd(from: number, to: number, total: number): number {
  if (total <= 0) return from;
  return Math.max(from, Math.min(to, total - 1));
}

/** Detects PostgREST 416 "Requested range not satisfiable" errors. */
export function isRangeNotSatisfiableError(error: {
  message?: string;
  code?: string;
  status?: number;
}): boolean {
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.status === 416 ||
    message.includes("requested range not satisfiable") ||
    error.code === "PGRST103"
  );
}
