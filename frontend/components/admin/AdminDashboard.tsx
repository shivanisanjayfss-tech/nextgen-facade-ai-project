"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { computeNextMonthlyRun } from "@/lib/next-scheduled-run";
import type { ApiResponse } from "@/types";
import type { ImportHistoryRow, ManufacturerImportReport } from "@/types/import-history";
import type { ManufacturerRegistryRow } from "@/types/manufacturer-registry";

interface DashboardMetrics {
  manufacturersInQueue: number;
  totalManufacturers: number;
  totalProducts: number;
  failedImports: number;
  updatedProducts: number;
  analyticsEvents30d: number;
  analyticsByEvent: Record<string, number>;
}

interface DashboardResponse {
  metrics: DashboardMetrics;
  manufacturers: ManufacturerRegistryRow[];
  recentImports: ImportHistoryRow[];
}

const ADMIN_LINKS = [
  { href: "/admin/import", label: "Import & Scheduler", description: "Run imports and manage the monthly scheduler" },
  { href: "/admin/manufacturers", label: "Manufacturers", description: "Configure the dynamic import queue" },
  { href: "/admin/import-history", label: "Import History", description: "Audit per-run import results" },
  { href: "/admin/datasheets", label: "Datasheet Intelligence", description: "AI extraction, review, and technical search facets" },
];

const STATUS_STYLES: Record<string, string> = {
  succeeded: "text-emerald-300 bg-emerald-400/10 border-emerald-400/20",
  failed: "text-red-300 bg-red-400/10 border-red-400/20",
  partial: "text-amber-300 bg-amber-400/10 border-amber-400/20",
  running: "text-sky-300 bg-sky-400/10 border-sky-400/20",
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function resolveNextImport(row: ManufacturerRegistryRow): string {
  return row.next_import_at ?? computeNextMonthlyRun().toISOString();
}

export function AdminDashboard() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [runMessage, setRunMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/dashboard");
      const json = (await response.json()) as ApiResponse<DashboardResponse>;

      if (!response.ok || !json.success) {
        throw new Error(json.success ? "Failed to load dashboard" : json.error.message);
      }

      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  async function toggleAutoImport(id: string, value: boolean) {
    setActionId(id);
    setError(null);

    try {
      const response = await fetch(`/api/import/manufacturers/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auto_import: value }),
      });
      const json = (await response.json()) as ApiResponse<{
        manufacturer: ManufacturerRegistryRow;
      }>;

      if (!response.ok || !json.success) {
        throw new Error(json.success ? "Update failed" : json.error.message);
      }

      setData((prev) =>
        prev
          ? {
              ...prev,
              manufacturers: prev.manufacturers.map((row) =>
                row.id === id ? json.data.manufacturer : row,
              ),
            }
          : prev,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setActionId(null);
    }
  }

  async function runImport(id: string, name: string) {
    setActionId(id);
    setError(null);
    setRunMessage(`Importing ${name}…`);

    try {
      const response = await fetch(`/api/import/manufacturers/${encodeURIComponent(id)}/run`, {
        method: "POST",
      });
      const json = (await response.json()) as ApiResponse<{
        report: ManufacturerImportReport;
      }>;

      if (!response.ok || !json.success) {
        throw new Error(json.success ? "Import failed" : json.error.message);
      }

      const { report } = json.data;
      setRunMessage(
        `${name}: ${report.status} — imported ${report.imported}, updated ${report.updated}`,
      );
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
      setRunMessage(null);
    } finally {
      setActionId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Admin Dashboard"
        description="Fully automatic manufacturer imports — configuration-driven from the registry. Add a row, enable auto import, and the monthly scheduler picks it up."
      />

      {isLoading && (
        <Card className="mb-8">
          <LoadingSpinner size="lg" label="Loading dashboard…" className="py-8" />
        </Card>
      )}

      {error && !isLoading && (
        <ErrorMessage message={error} onRetry={() => void loadDashboard()} className="mb-8" />
      )}

      {data && !isLoading && (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard label="Products" value={data.metrics.totalProducts} />
            <MetricCard label="Manufacturers" value={data.metrics.totalManufacturers} />
            <MetricCard label="Monthly import queue" value={data.metrics.manufacturersInQueue} />
            <MetricCard label="Updated (history)" value={data.metrics.updatedProducts} />
            <MetricCard label="Failed imports" value={data.metrics.failedImports} />
            <MetricCard label="Analytics (30d)" value={data.metrics.analyticsEvents30d} />
          </div>

          {runMessage && (
            <div className="mb-4 rounded-xl border border-sky-400/20 bg-sky-400/10 px-4 py-3 text-sm text-sky-200">
              {runMessage}
            </div>
          )}

          <div className="mb-8 grid gap-4 md:grid-cols-3">
            {ADMIN_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 transition-colors hover:border-white/[0.16] hover:bg-white/[0.04]"
              >
                <h3 className="font-semibold text-white">{link.label}</h3>
                <p className="mt-2 text-sm text-white/50">{link.description}</p>
              </Link>
            ))}
          </div>

          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Automatic import manufacturers</CardTitle>
              <CardDescription>
                Every registry row with enabled=true, auto_import=true, and import_frequency=monthly
                is included in the next monthly scheduler run. No code changes required when adding
                a manufacturer.
              </CardDescription>
            </CardHeader>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-white/50">
                    <th className="px-6 py-3 font-medium">Manufacturer</th>
                    <th className="px-6 py-3 font-medium">Category</th>
                    <th className="px-6 py-3 font-medium">Products</th>
                    <th className="px-6 py-3 font-medium">Last Import</th>
                    <th className="px-6 py-3 font-medium">Next Import</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium">Run Now</th>
                    <th className="px-6 py-3 font-medium">Auto Import</th>
                  </tr>
                </thead>
                <tbody>
                  {data.manufacturers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-white/50">
                        No manufacturers in registry. Apply migrations 014–015 in Supabase.
                      </td>
                    </tr>
                  ) : (
                    data.manufacturers.map((row) => {
                      const isBusy = actionId === row.id;
                      const statusKey = row.last_status ?? "—";
                      const statusStyle =
                        STATUS_STYLES[statusKey] ??
                        "border-white/10 bg-white/[0.03] text-white/45";
                      const inMonthlyQueue =
                        row.enabled && row.auto_import && row.import_frequency === "monthly";

                      return (
                        <tr
                          key={row.id}
                          className="border-b border-white/5 text-white/70 hover:bg-white/[0.02]"
                        >
                          <td className="px-6 py-4">
                            <Link
                              href={`/manufacturers/${row.slug}`}
                              className="font-medium text-white hover:text-sky-300"
                            >
                              {row.name}
                            </Link>
                            {row.brand && (
                              <p className="mt-0.5 text-xs text-white/40">
                                Brand: {row.brand}
                              </p>
                            )}
                            {!row.enabled && (
                              <p className="mt-0.5 text-xs text-white/35">Disabled</p>
                            )}
                            {inMonthlyQueue && (
                              <p className="mt-0.5 text-xs text-emerald-300/80">In monthly queue</p>
                            )}
                          </td>
                          <td className="px-6 py-4">{row.category}</td>
                          <td className="px-6 py-4 tabular-nums">{row.total_products}</td>
                          <td className="px-6 py-4 text-xs text-white/50">
                            {formatDate(row.last_imported_at)}
                          </td>
                          <td className="px-6 py-4 text-xs text-white/50">
                            {formatDate(resolveNextImport(row))}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${statusStyle}`}
                            >
                              {statusKey}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isBusy || !row.enabled}
                              onClick={() => void runImport(row.id, row.name)}
                            >
                              Run Now
                            </Button>
                          </td>
                          <td className="px-6 py-4">
                            <label className="inline-flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={row.auto_import}
                                disabled={isBusy || !row.enabled}
                                onChange={(event) =>
                                  void toggleAutoImport(row.id, event.target.checked)
                                }
                              />
                              <span className="text-xs">{row.auto_import ? "On" : "Off"}</span>
                            </label>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent imports</CardTitle>
              <CardDescription>Latest scheduled and manual import runs.</CardDescription>
            </CardHeader>
            {data.recentImports.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-white/50">No import history yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-white/50">
                      <th className="px-6 py-3 font-medium">Manufacturer</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                      <th className="px-6 py-3 font-medium text-right">Imported</th>
                      <th className="px-6 py-3 font-medium text-right">Updated</th>
                      <th className="px-6 py-3 font-medium text-right">Failed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentImports.map((row) => (
                      <tr key={row.id} className="border-b border-white/5 text-white/70">
                        <td className="px-6 py-4">{row.manufacturer}</td>
                        <td className="px-6 py-4 capitalize">{row.status}</td>
                        <td className="px-6 py-4 text-right tabular-nums">{row.imported}</td>
                        <td className="px-6 py-4 text-right tabular-nums">{row.updated}</td>
                        <td className="px-6 py-4 text-right tabular-nums">{row.failed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-5">
      <p className="text-xs uppercase tracking-wide text-white/40">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-white">{value}</p>
    </Card>
  );
}
