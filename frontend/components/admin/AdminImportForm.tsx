"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { Input } from "@/components/ui/Input";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { buildQueryString } from "@/lib/utils";
import type { ApiResponse } from "@/types";
import type { CrawlImportResult } from "@/types/import";
import type { MaterialCategory } from "@/types";

const CATEGORIES: MaterialCategory[] = [
  "ACP",
  "Glass",
  "Stone",
  "HPL",
  "Louvers",
  "Metal",
  "Composite",
  "Other",
];

const DEFAULT_FORM = {
  manufacturer: "",
  websiteUrl: "",
  category: "ACP" as MaterialCategory,
};

interface ImportStats {
  imported: number;
  updated: number;
  skipped: number;
  productCount: number;
  crawledPages: number;
  status: string;
  notes: string[];
  errors: Array<{ sourceUrl: string; productName: string; message: string }>;
}

export function AdminImportForm() {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ImportStats | null>(null);

  async function runImport() {
    setIsLoading(true);
    setError(null);
    setStats(null);

    const manufacturer = form.manufacturer.trim();
    const websiteUrl = form.websiteUrl.trim();
    const category = form.category;

    if (!manufacturer || !websiteUrl || !category) {
      setError("Manufacturer, website URL, and category are required.");
      setIsLoading(false);
      return;
    }

    try {
      const query = buildQueryString({
        manufacturer,
        url: websiteUrl,
        category,
        maxPages: 10,
        timeout: 90_000,
      });

      const response = await fetch(`/api/apify/import${query}`);
      const json = (await response.json()) as ApiResponse<CrawlImportResult>;

      if (!response.ok || !json.success) {
        throw new Error(
          json.success ? "Import failed" : json.error.message,
        );
      }

      const { data } = json;
      setStats({
        imported: data.persist?.imported ?? 0,
        updated: data.persist?.updated ?? 0,
        skipped: data.persist?.skipped ?? 0,
        productCount: data.product_count,
        crawledPages: data.crawled_pages,
        status: data.status,
        notes: data.notes,
        errors: data.persist?.errors ?? [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleImport(event: React.FormEvent) {
    event.preventDefault();
    await runImport();
  }

  return (
    <>
      <PageHeader
        title="Admin Import"
        description="Crawl a manufacturer website and upsert products into Supabase. Uses the same Apify importer as the Alucobond endpoint."
      />

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Manufacturer import</CardTitle>
          <CardDescription>
            Enter the manufacturer details below. Products are deduplicated by slug and source URL.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleImport} className="space-y-5">
          <Input
            label="Manufacturer"
            placeholder="e.g. Alucobond"
            value={form.manufacturer}
            onChange={(event) =>
              setForm((current) => ({ ...current, manufacturer: event.target.value }))
            }
            required
          />

          <Input
            label="Website URL"
            type="url"
            placeholder="https://www.alucobond.com/en/products/"
            value={form.websiteUrl}
            onChange={(event) =>
              setForm((current) => ({ ...current, websiteUrl: event.target.value }))
            }
            required
          />

          <div className="w-full">
            <label
              htmlFor="import-category"
              className="mb-2 block text-sm font-medium text-white/60"
            >
              Category
            </label>
            <select
              id="import-category"
              value={form.category}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  category: event.target.value as MaterialCategory,
                }))
              }
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white backdrop-blur-xl transition-all focus:border-white/20 focus:bg-white/[0.07] focus:outline-none focus:ring-2 focus:ring-white/10"
            >
              {CATEGORIES.map((category) => (
                <option key={category} value={category} className="bg-[#0B1120]">
                  {category}
                </option>
              ))}
            </select>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            {isLoading ? "Importing…" : "Import products"}
          </Button>
        </form>
      </Card>

      {isLoading && (
        <Card className="mb-8">
          <LoadingSpinner
            size="lg"
            label="Crawling website and saving to Supabase…"
            className="py-8"
          />
        </Card>
      )}

      {error && !isLoading && (
        <ErrorMessage message={error} onRetry={runImport} className="mb-8" />
      )}

      {stats && !isLoading && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Import results</CardTitle>
              <CardDescription>
                Crawl status: {stats.status} · {stats.crawledPages} pages crawled ·{" "}
                {stats.productCount} products extracted
              </CardDescription>
            </CardHeader>

            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard label="Imported" value={stats.imported} tone="green" />
              <StatCard label="Updated" value={stats.updated} tone="blue" />
              <StatCard label="Skipped" value={stats.skipped} tone="neutral" />
            </div>
          </Card>

          {stats.notes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <ul className="space-y-2 text-sm text-white/60">
                {stats.notes.map((note) => (
                  <li key={note}>• {note}</li>
                ))}
              </ul>
            </Card>
          )}

          {stats.errors.length > 0 && (
            <Card className="border-red-400/20">
              <CardHeader>
                <CardTitle className="text-red-300">Import errors</CardTitle>
                <CardDescription>
                  {stats.errors.length} product(s) could not be saved.
                </CardDescription>
              </CardHeader>
              <ul className="space-y-3">
                {stats.errors.map((entry) => (
                  <li
                    key={`${entry.sourceUrl}-${entry.productName}`}
                    className="rounded-xl border border-red-400/10 bg-red-400/5 px-4 py-3 text-sm"
                  >
                    <p className="font-medium text-red-200">{entry.productName}</p>
                    <p className="mt-1 text-red-300/60">{entry.message}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "green" | "blue" | "neutral";
}) {
  const toneStyles = {
    green: "border-emerald-400/20 bg-emerald-400/5 text-emerald-300",
    blue: "border-sky-400/20 bg-sky-400/5 text-sky-300",
    neutral: "border-white/10 bg-white/[0.03] text-white/70",
  };

  return (
    <div className={`rounded-xl border px-4 py-5 text-center ${toneStyles[tone]}`}>
      <p className="text-3xl font-bold tabular-nums">{value}</p>
      <p className="mt-1 text-sm opacity-80">{label}</p>
    </div>
  );
}
