import { describe, expect, it } from "vitest";
import {
  applyBatchFilter,
  computeBatchAnalytics,
  computeDashboardAnalytics,
  computeHistoryAnalytics,
  computeSuccessRate,
  isSuccessRateApplicable,
} from "@/lib/import-history-analytics";
import type { ImportBatchSummary } from "@/types/import-analytics";
import type { ImportHistoryRow } from "@/types/import-history";

function makeHistoryRow(
  overrides: Partial<ImportHistoryRow> & Pick<ImportHistoryRow, "id" | "manufacturer">,
): ImportHistoryRow {
  return {
    status: "succeeded",
    trigger: "manual",
    started_at: "2026-01-01T00:00:00.000Z",
    finished_at: "2026-01-01T00:05:00.000Z",
    duration_seconds: 300,
    imported: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    ignored: 0,
    extracted_products: 0,
    crawled_pages: 0,
    crawl_status: "completed",
    scheduler_run_id: null,
    error_message: null,
    product_decisions: [],
    diagnostics: {},
    ...overrides,
  };
}

function makeBatch(
  overrides: Partial<ImportBatchSummary> & Pick<ImportBatchSummary, "id">,
): ImportBatchSummary {
  return {
    trigger: "cron",
    started_at: "2026-01-01T00:00:00.000Z",
    finished_at: "2026-01-01T00:10:00.000Z",
    duration_seconds: 600,
    status: "partial",
    manufacturer_total: 2,
    imported: 1,
    updated: 0,
    skipped: 0,
    failed: 0,
    ignored: 0,
    error_message: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:10:00.000Z",
    manufacturerRunCount: 2,
    ...overrides,
  };
}

describe("computeHistoryAnalytics", () => {
  it("sums imported, updated, failed, and averages duration from rows", () => {
    const rows = [
      makeHistoryRow({
        id: "a",
        manufacturer: "Alpha",
        imported: 3,
        updated: 1,
        failed: 2,
        duration_seconds: 100,
      }),
      makeHistoryRow({
        id: "b",
        manufacturer: "Beta",
        imported: 2,
        updated: 4,
        failed: 1,
        duration_seconds: 300,
      }),
    ];

    const analytics = computeHistoryAnalytics(rows, { status: "all" });

    expect(analytics.totals.imported).toBe(5);
    expect(analytics.totals.updated).toBe(5);
    expect(analytics.totals.failed).toBe(3);
    expect(analytics.averageDurationSeconds).toBe(200);
    expect(analytics.filteredCount).toBe(2);
  });

  it("returns N/A success rate for partial-only filter", () => {
    const rows = [
      makeHistoryRow({
        id: "a",
        manufacturer: "Alpha",
        status: "partial",
        imported: 1,
      }),
    ];

    const analytics = computeHistoryAnalytics(rows, { status: "partial" });

    expect(analytics.successRate).toBeNull();
    expect(analytics.totals.imported).toBe(1);
  });
});

describe("computeBatchAnalytics", () => {
  it("aggregates batch totals shown in the batch table", () => {
    const batches = [
      makeBatch({ id: "batch-1", imported: 1, updated: 0, status: "partial" }),
      makeBatch({ id: "batch-2", imported: 4, updated: 2, status: "succeeded" }),
    ];

    const analytics = computeBatchAnalytics(batches, { status: "all" });

    expect(analytics.totals.imported).toBe(5);
    expect(analytics.totals.updated).toBe(2);
    expect(analytics.filteredCount).toBe(2);
    expect(analytics.successRate).toBe(50);
  });
});

describe("applyBatchFilter", () => {
  it("filters batches by status and updated-only preset", () => {
    const batches = [
      makeBatch({ id: "partial-batch", status: "partial", imported: 1 }),
      makeBatch({ id: "updated-batch", status: "succeeded", imported: 0, updated: 3 }),
      makeBatch({ id: "failed-batch", status: "failed", imported: 0, updated: 0 }),
    ];

    expect(applyBatchFilter(batches, { status: "partial" })).toHaveLength(1);
    expect(applyBatchFilter(batches, { status: "all", preset: "updated_only" })).toHaveLength(1);
    expect(
      applyBatchFilter(batches, { status: "all", preset: "zero_products" }).map((batch) => batch.id),
    ).toEqual(["failed-batch"]);
  });
});

describe("computeDashboardAnalytics", () => {
  it("uses batch rows for batch view and history rows for run views", () => {
    const history = [
      makeHistoryRow({ id: "h1", manufacturer: "Alpha", imported: 99 }),
    ];
    const batches = [makeBatch({ id: "batch-1", imported: 1, status: "partial" })];

    const batchAnalytics = computeDashboardAnalytics("batches", {
      history,
      batches,
      filter: { status: "partial" },
    });

    expect(batchAnalytics.totals.imported).toBe(1);
    expect(batchAnalytics.successRate).toBeNull();

    const runAnalytics = computeDashboardAnalytics("all", {
      history,
      batches,
      filter: { status: "all" },
    });

    expect(runAnalytics.totals.imported).toBe(99);
  });
});

describe("computeSuccessRate", () => {
  it("marks non-applicable filters as N/A", () => {
    expect(isSuccessRateApplicable({ status: "partial" })).toBe(false);
    expect(
      computeSuccessRate(
        { running: 0, succeeded: 0, failed: 0, partial: 2 },
        { status: "partial" },
      ),
    ).toBeNull();
  });

  it("calculates success rate for mixed terminal statuses", () => {
    expect(
      computeSuccessRate(
        { running: 0, succeeded: 3, failed: 1, partial: 1 },
        { status: "all" },
      ),
    ).toBe(60);
  });
});
