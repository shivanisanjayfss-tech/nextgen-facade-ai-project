"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { Input } from "@/components/ui/Input";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ManufacturerRegistryForm } from "@/components/admin/ManufacturerRegistryForm";
import { MATERIAL_CATEGORIES } from "@/lib/material-categories";
import {
  createEmptyManufacturerFormValues,
  formValuesFromRegistryRow,
  formValuesToCreateInput,
  formValuesToUpdateInput,
  validateManufacturerFormValues,
  type ManufacturerRegistryFormValues,
} from "@/lib/manufacturer-registry-defaults";
import { buildQueryString } from "@/lib/utils";
import type { ApiResponse } from "@/types";
import type { ManufacturerRegistryRow, UpdateManufacturerRegistryInput } from "@/types/manufacturer-registry";
import type { ManufacturerImportReport } from "@/types/import-history";

interface ManufacturersResponse {
  manufacturers: ManufacturerRegistryRow[];
}

interface SearchFilters {
  q: string;
  category: string;
  country: string;
  website: string;
}

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

function ManufacturerLogo({ name, logoUrl }: { name: string; logoUrl?: string | null }) {
  if (logoUrl?.startsWith("/")) {
    return (
      <div className="relative h-10 w-10 overflow-hidden rounded-lg border border-white/10 bg-white/5">
        <Image src={logoUrl} alt={`${name} logo`} fill className="object-contain p-1.5" />
      </div>
    );
  }

  if (logoUrl) {
    return (
      <div className="relative h-10 w-10 overflow-hidden rounded-lg border border-white/10 bg-white/5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt={`${name} logo`} className="h-full w-full object-contain p-1.5" />
      </div>
    );
  }

  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-xs font-semibold text-white/45">
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

export function ManufacturerRegistryAdmin() {
  const [manufacturers, setManufacturers] = useState<ManufacturerRegistryRow[]>([]);
  const [filters, setFilters] = useState<SearchFilters>({
    q: "",
    category: "",
    country: "",
    website: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<ManufacturerRegistryFormValues>(
    createEmptyManufacturerFormValues(),
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [isSavingForm, setIsSavingForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  const loadManufacturers = useCallback(async (search: SearchFilters) => {
    setIsLoading(true);
    setError(null);

    try {
      const query = buildQueryString({
        q: search.q || undefined,
        category: search.category || undefined,
        country: search.country || undefined,
        website: search.website || undefined,
      });

      const response = await fetch(`/api/import/manufacturers${query}`);
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
    void loadManufacturers(filters);
  }, [filters, loadManufacturers]);

  const queuedCount = useMemo(
    () =>
      manufacturers.filter(
        (row) =>
          row.enabled && row.auto_import && row.import_frequency === "monthly",
      ).length,
    [manufacturers],
  );

  async function patchManufacturer(
    id: string,
    input: UpdateManufacturerRegistryInput,
  ): Promise<ManufacturerRegistryRow | null> {
    setActionId(id);
    setError(null);

    try {
      const response = await fetch(`/api/import/manufacturers/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
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
      return json.data.manufacturer;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
      return null;
    } finally {
      setActionId(null);
    }
  }

  async function runImport(id: string, name: string) {
    setActionId(id);
    setError(null);
    setImportMessage(`Importing ${name}…`);

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
      setImportMessage(
        `${name}: ${report.status} — imported ${report.imported}, updated ${report.updated}, skipped ${report.skipped}`,
      );
      await loadManufacturers(filters);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
      setImportMessage(null);
    } finally {
      setActionId(null);
    }
  }

  function openCreate() {
    setFormMode("create");
    setEditingId(null);
    setFormValues(createEmptyManufacturerFormValues());
    setFormError(null);
  }

  function openEdit(row: ManufacturerRegistryRow) {
    setFormMode("edit");
    setEditingId(row.id);
    setFormValues(formValuesFromRegistryRow(row));
    setFormError(null);
  }

  function closeForm() {
    setFormMode(null);
    setEditingId(null);
    setFormValues(createEmptyManufacturerFormValues());
    setFormError(null);
  }

  async function saveForm() {
    const validationError = validateManufacturerFormValues(formValues);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setIsSavingForm(true);
    setFormError(null);
    setError(null);

    try {
      if (formMode === "create") {
        const response = await fetch("/api/import/manufacturers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formValuesToCreateInput(formValues)),
        });
        const json = (await response.json()) as ApiResponse<{
          manufacturer: ManufacturerRegistryRow;
        }>;

        if (!response.ok || !json.success) {
          throw new Error(json.success ? "Create failed" : json.error.message);
        }

        setManufacturers((rows) =>
          [...rows, json.data.manufacturer].sort((a, b) =>
            a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
          ),
        );
      } else if (formMode === "edit" && editingId) {
        const updated = await patchManufacturer(
          editingId,
          formValuesToUpdateInput(formValues),
        );
        if (!updated) return;
      }

      closeForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsSavingForm(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Manufacturer Registry"
        description="Canonical manufacturer registry for scheduling and product identity. Manufacturers with zero products remain listed here."
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Button onClick={openCreate}>Add Manufacturer</Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadManufacturers(filters)}
          disabled={isLoading}
        >
          Refresh
        </Button>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Search</CardTitle>
          <CardDescription>
            Filter by manufacturer name, category, country, or website. {queuedCount} of{" "}
            {manufacturers.length} shown manufacturer(s) are in the monthly import queue.
          </CardDescription>
        </CardHeader>

        <div className="grid gap-4 px-6 pb-6 md:grid-cols-2 xl:grid-cols-4">
          <Input
            label="Manufacturer name"
            value={filters.q}
            onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))}
            placeholder="Search name, brand…"
          />
          <div>
            <label className="mb-2 block text-sm font-medium text-white/60">Category</label>
            <select
              value={filters.category}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, category: event.target.value }))
              }
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white focus:border-white/20 focus:outline-none"
            >
              <option value="">All categories</option>
              {MATERIAL_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Country"
            value={filters.country}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, country: event.target.value }))
            }
            placeholder="e.g. USA"
          />
          <Input
            label="Website"
            value={filters.website}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, website: event.target.value }))
            }
            placeholder="e.g. alucobond.com"
          />
        </div>

        <div className="flex flex-wrap gap-3 px-6 pb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setFilters({ q: "", category: "", country: "", website: "" })
            }
          >
            Clear filters
          </Button>
        </div>
      </Card>

      {importMessage && (
        <div className="mb-4 rounded-xl border border-sky-400/20 bg-sky-400/10 px-4 py-3 text-sm text-sky-200">
          {importMessage}
        </div>
      )}

      {isLoading && (
        <LoadingSpinner size="md" label="Loading manufacturer registry…" className="py-12" />
      )}

      {error && !isLoading && (
        <ErrorMessage message={error} onRetry={() => void loadManufacturers(filters)} />
      )}

      {!isLoading && !error && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1280px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-white/50">
                  <th className="px-6 py-3 font-medium">Logo</th>
                  <th className="px-6 py-3 font-medium">Manufacturer</th>
                  <th className="px-6 py-3 font-medium">Category</th>
                  <th className="px-6 py-3 font-medium">Website</th>
                  <th className="px-6 py-3 font-medium">Products</th>
                  <th className="px-6 py-3 font-medium">Auto Import</th>
                  <th className="px-6 py-3 font-medium">Frequency</th>
                  <th className="px-6 py-3 font-medium">Last Import</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {manufacturers.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-8 text-white/50">
                      No manufacturers match your filters. If empty with no filters, apply
                      migrations 014–019 (or run{" "}
                      <code className="text-white/70">npm run db:apply-manufacturer-registry</code>
                      ). Zero-product manufacturers remain visible here once the registry is seeded.
                    </td>
                  </tr>
                ) : (
                  manufacturers.map((row) => {
                    const isBusy = actionId === row.id;
                    const statusKey = row.last_status ?? "—";
                    const statusStyle =
                      STATUS_STYLES[statusKey] ?? "border-white/10 bg-white/[0.03] text-white/45";

                    return (
                      <tr
                        key={row.id}
                        className="border-b border-white/5 text-white/70 hover:bg-white/[0.02]"
                      >
                        <td className="px-6 py-4">
                          <ManufacturerLogo name={row.name} logoUrl={row.logo_url} />
                        </td>
                        <td className="px-6 py-4">
                          <Link
                            href={`/manufacturers/${row.slug}`}
                            className="group block"
                          >
                            <p className="font-medium text-white group-hover:text-sky-300">
                              {row.name}
                            </p>
                            {row.brand && (
                              <p className="mt-0.5 text-xs text-white/40">
                                Brand: {row.brand}
                              </p>
                            )}
                            {row.aliases.length > 0 && (
                              <p className="mt-0.5 text-xs text-white/30">
                                Aliases: {row.aliases.join(", ")}
                              </p>
                            )}
                            {row.country && (
                              <p className="mt-0.5 text-xs text-white/35">{row.country}</p>
                            )}
                          </Link>
                        </td>
                        <td className="px-6 py-4">{row.category}</td>
                        <td className="px-6 py-4">
                          <a
                            href={row.website}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sky-300 hover:underline"
                          >
                            {row.website.replace(/^https?:\/\//, "")}
                          </a>
                        </td>
                        <td className="px-6 py-4">{row.total_products}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                              row.auto_import
                                ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                                : "border-white/10 bg-white/[0.03] text-white/45"
                            }`}
                          >
                            {row.auto_import ? "On" : "Off"}
                          </span>
                        </td>
                        <td className="px-6 py-4 capitalize">{row.import_frequency}</td>
                        <td className="px-6 py-4 text-xs text-white/50">
                          {formatDate(row.last_imported_at)}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${statusStyle}`}
                          >
                            {statusKey}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isBusy}
                              onClick={() => void runImport(row.id, row.name)}
                            >
                              Run Import
                            </Button>
                            {row.enabled ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={isBusy}
                                onClick={() => void patchManufacturer(row.id, { enabled: false })}
                              >
                                Disable
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={isBusy}
                                onClick={() => void patchManufacturer(row.id, { enabled: true })}
                              >
                                Enable
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={isBusy}
                              onClick={() => openEdit(row)}
                            >
                              Edit
                            </Button>
                            <Link href={`/manufacturers/${row.slug}`}>
                              <Button variant="ghost" size="sm">
                                View Products
                              </Button>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {formMode && (
        <ManufacturerRegistryForm
          mode={formMode}
          values={formValues}
          isSaving={isSavingForm}
          error={formError}
          onChange={setFormValues}
          onSubmit={() => void saveForm()}
          onCancel={closeForm}
        />
      )}
    </>
  );
}
