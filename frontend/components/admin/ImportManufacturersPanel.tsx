"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { ApiResponse } from "@/types";
import type { ManufacturerRegistryRow } from "@/types/manufacturer-registry";

interface ManufacturersResponse {
  manufacturers: ManufacturerRegistryRow[];
}

export function ImportManufacturersPanel() {
  const [manufacturers, setManufacturers] = useState<ManufacturerRegistryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadManufacturers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/import/manufacturers");
      const json = (await response.json()) as ApiResponse<ManufacturersResponse>;

      if (!response.ok || !json.success) {
        throw new Error(json.success ? "Failed to load manufacturers" : json.error.message);
      }

      setManufacturers(json.data.manufacturers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load manufacturers");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadManufacturers();
  }, [loadManufacturers]);

  async function toggleField(
    id: string,
    field: "enabled" | "auto_import",
    value: boolean,
  ) {
    setUpdatingId(id);
    setError(null);

    try {
      const response = await fetch(`/api/import/manufacturers/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      const json = (await response.json()) as ApiResponse<{
        manufacturer: ManufacturerRegistryRow;
      }>;

      if (!response.ok || !json.success) {
        throw new Error(json.success ? "Update failed" : json.error.message);
      }

      setManufacturers((rows) =>
        rows.map((row) => (row.id === id ? json.data.manufacturer : row)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setUpdatingId(null);
    }
  }

  const queuedCount = manufacturers.filter((row) => row.enabled && row.auto_import).length;

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Manufacturer Registry</CardTitle>
        <CardDescription>
          Database-driven manufacturer registry. {queuedCount} of {manufacturers.length}{" "}
          manufacturer(s) are in the monthly import queue (enabled + auto_import).
        </CardDescription>
      </CardHeader>

      <div className="px-6 pb-4">
        <Button variant="outline" size="sm" onClick={() => void loadManufacturers()} disabled={isLoading}>
          Refresh
        </Button>
      </div>

      {isLoading && (
        <LoadingSpinner size="md" label="Loading manufacturer registry…" className="px-6 pb-6" />
      )}

      {error && !isLoading && (
        <div className="px-6 pb-6">
          <ErrorMessage message={error} onRetry={() => void loadManufacturers()} />
        </div>
      )}

      {!isLoading && !error && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-white/50">
                <th className="px-6 py-3 font-medium">Manufacturer</th>
                <th className="px-6 py-3 font-medium">Category</th>
                <th className="px-6 py-3 font-medium">Strategy</th>
                <th className="px-6 py-3 font-medium">Frequency</th>
                <th className="px-6 py-3 font-medium">Enabled</th>
                <th className="px-6 py-3 font-medium">Auto Import</th>
                <th className="px-6 py-3 font-medium">In Queue</th>
              </tr>
            </thead>
            <tbody>
              {manufacturers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-6 text-white/50">
                    No manufacturers in registry. Apply migration 014 to seed the database.
                  </td>
                </tr>
              ) : (
                manufacturers.map((row) => {
                  const inQueue = row.enabled && row.auto_import;
                  const isUpdating = updatingId === row.id;

                  return (
                    <tr
                      key={row.id}
                      className="border-b border-white/5 text-white/70 hover:bg-white/[0.02]"
                    >
                      <td className="px-6 py-4">
                        <p className="font-medium text-white">{row.name}</p>
                        {row.brand && (
                          <p className="mt-0.5 text-xs text-white/40">{row.brand}</p>
                        )}
                      </td>
                      <td className="px-6 py-4">{row.category}</td>
                      <td className="px-6 py-4 font-mono text-xs text-white/50">
                        {row.import_strategy}
                      </td>
                      <td className="px-6 py-4 capitalize text-white/60">
                        {row.import_frequency}
                      </td>
                      <td className="px-6 py-4">
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={row.enabled}
                            disabled={isUpdating}
                            onChange={(event) =>
                              void toggleField(row.id, "enabled", event.target.checked)
                            }
                          />
                          <span className="text-xs">{row.enabled ? "Yes" : "No"}</span>
                        </label>
                      </td>
                      <td className="px-6 py-4">
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={row.auto_import}
                            disabled={isUpdating}
                            onChange={(event) =>
                              void toggleField(row.id, "auto_import", event.target.checked)
                            }
                          />
                          <span className="text-xs">{row.auto_import ? "Yes" : "No"}</span>
                        </label>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                            inQueue
                              ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                              : "border-white/10 bg-white/[0.03] text-white/45"
                          }`}
                        >
                          {inQueue ? "Queued" : "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
