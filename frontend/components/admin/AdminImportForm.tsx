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
  discoveredProductUrls: string[];
  discoveredEntryUrls: string[];
  crawlStartUrls: string[];
  crawlUrls: string[];
  ignoredPages: Array<{ url: string; reason: string }>;
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
        maxPages: 50,
        timeout: 120_000,
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
        imported: data.import_summary?.imported ?? data.persist?.imported ?? 0,
        updated: data.persist?.updated ?? 0,
        skipped: data.import_summary?.skipped ?? data.persist?.skipped ?? 0,
        productCount: data.product_count,
        crawledPages: data.crawled_pages,
        status: data.status,
        notes: data.notes,
        discoveredProductUrls: data.discovered_product_urls ?? [],
        discoveredEntryUrls: data.discovered_entry_urls ?? [],
        crawlStartUrls: data.crawl_start_urls ?? [],
        crawlUrls: data.crawl_urls ?? [],
        ignoredPages: data.ignored_pages ?? [],
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
            placeholder="https://www.alucobond.com/en/products/ or https://www.guardianglass.com"
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

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Imported" value={stats.imported} tone="green" />
              <StatCard label="Updated" value={stats.updated} tone="blue" />
              <StatCard label="Skipped" value={stats.skipped} tone="neutral" />
              <StatCard label="Ignored" value={stats.ignoredPages.length} tone="amber" />
            </div>
          </Card>

          {stats.crawlStartUrls.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Crawl start URLs</CardTitle>
                <CardDescription>
                  Catalogue entry points sent to the crawler before extraction.
                </CardDescription>
              </CardHeader>
              <ul className="space-y-2 text-sm text-white/60">
                {stats.crawlStartUrls.map((url) => (
                  <li key={url} className="break-all">
                    • {url}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {stats.crawlUrls.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Crawled URLs</CardTitle>
                <CardDescription>
                  {stats.crawlUrls.length} page(s) crawled before product extraction.
                </CardDescription>
              </CardHeader>
              <ul className="max-h-64 space-y-2 overflow-y-auto text-sm text-white/60">
                {stats.crawlUrls.map((url) => (
                  <li key={url} className="break-all">
                    • {url}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {stats.discoveredEntryUrls.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Discovered entry URLs</CardTitle>
                <CardDescription>
                  Product-section links found on the homepage before crawling.
                </CardDescription>
              </CardHeader>
              <ul className="space-y-2 text-sm text-white/60">
                {stats.discoveredEntryUrls.map((url) => (
                  <li key={url} className="break-all">
                    • {url}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {stats.discoveredProductUrls.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Discovered product URLs</CardTitle>
                <CardDescription>
                  {stats.discoveredProductUrls.length} product page(s) identified before extraction.
                </CardDescription>
              </CardHeader>
              <ul className="max-h-64 space-y-2 overflow-y-auto text-sm text-white/60">
                {stats.discoveredProductUrls.map((url) => (
                  <li key={url} className="break-all">
                    • {url}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {stats.ignoredPages.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Ignored pages</CardTitle>
                <CardDescription>
                  {stats.ignoredPages.length} page(s) excluded from import.
                </CardDescription>
              </CardHeader>
              <ul className="max-h-64 space-y-3 overflow-y-auto text-sm">
                {stats.ignoredPages.map((entry) => (
                  <li
                    key={`${entry.url}-${entry.reason}`}
                    className="rounded-xl border border-amber-400/10 bg-amber-400/5 px-4 py-3 text-white/70"
                  >
                    <p className="break-all">{entry.url}</p>
                    <p className="mt-1 text-amber-200/70">{entry.reason}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}

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
  tone: "green" | "blue" | "neutral" | "amber";
}) {
  const toneStyles = {
    green: "border-emerald-400/20 bg-emerald-400/5 text-emerald-300",
    blue: "border-sky-400/20 bg-sky-400/5 text-sky-300",
    neutral: "border-white/10 bg-white/[0.03] text-white/70",
    amber: "border-amber-400/20 bg-amber-400/5 text-amber-300",
  };

  return (
    <div className={`rounded-xl border px-4 py-5 text-center ${toneStyles[tone]}`}>
      <p className="text-3xl font-bold tabular-nums">{value}</p>
      <p className="mt-1 text-sm opacity-80">{label}</p>
    </div>
  );
}
