"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageContainer";
import Link from "next/link";
import { ImportSchedulerPanel } from "@/components/admin/ImportSchedulerPanel";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { Input } from "@/components/ui/Input";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { buildQueryString } from "@/lib/utils";
import { resolveImportModeLimits, type ImportMode } from "@/services/import-limits";
import type { ApiResponse } from "@/types";
import type { CrawlImportResult, CrawlPollUpdate } from "@/types/import";
import { MATERIAL_CATEGORIES } from "@/lib/material-categories";
import type { MaterialCategory } from "@/types";

const CATEGORIES = MATERIAL_CATEGORIES;

const DEFAULT_FORM = {
  manufacturer: "",
  websiteUrl: "",
  category: "ACP Sheet" as MaterialCategory,
  importMode: "quick" as ImportMode,
};

interface ImportStats {
  imported: number;
  updated: number;
  skipped: number;
  duplicatesMerged: number;
  ignored: number;
  productCount: number;
  crawledPages: number;
  status: string;
  notes: string[];
  discoveredProductUrls: string[];
  discoveredEntryUrls: string[];
  crawlStartUrls: string[];
  crawlUrls: string[];
  ignoredPages: Array<{ url: string; reason: string }>;
  pollUpdates: CrawlPollUpdate[];
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
      const limits = resolveImportModeLimits(form.importMode);
      const query = buildQueryString({
        manufacturer,
        url: websiteUrl,
        category,
        maxPages: limits.maxPages,
        limit: limits.limit,
        timeout: limits.timeout,
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
        updated:
          data.import_summary?.updated ?? data.persist?.updated ?? 0,
        skipped: data.import_summary?.skipped ?? data.persist?.skipped ?? 0,
        duplicatesMerged:
          data.import_summary?.duplicates_merged ??
          data.persist?.duplicates_merged ??
          0,
        ignored:
          data.import_summary?.ignored ?? data.ignored_pages?.length ?? 0,
        productCount: data.product_count,
        crawledPages: data.crawled_pages,
        status: data.status,
        notes: data.notes,
        discoveredProductUrls: data.discovered_product_urls ?? [],
        discoveredEntryUrls: data.discovered_entry_urls ?? [],
        crawlStartUrls: data.crawl_start_urls ?? [],
        crawlUrls: data.crawl_urls ?? [],
        ignoredPages: data.ignored_pages ?? [],
        pollUpdates: data.poll_updates ?? [],
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

      <ImportSchedulerPanel />

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Manufacturer Registry</CardTitle>
          <CardDescription>
            Configure manufacturers, run imports, and manage the monthly scheduler queue from the
            dedicated registry page.
          </CardDescription>
        </CardHeader>
        <div className="px-6 pb-6">
          <Link href="/admin/manufacturers">
            <Button variant="outline" size="sm">
              Open Manufacturer Registry
            </Button>
          </Link>
        </div>
      </Card>

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
              htmlFor="import-mode"
              className="mb-2 block text-sm font-medium text-white/60"
            >
              Import mode
            </label>
            <select
              id="import-mode"
              value={form.importMode}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  importMode: event.target.value as ImportMode,
                }))
              }
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white backdrop-blur-xl transition-all focus:border-white/20 focus:bg-white/[0.07] focus:outline-none focus:ring-2 focus:ring-white/10"
            >
              <option value="quick" className="bg-[#0B1120]">
                Quick Import — 10 pages, 30s timeout
              </option>
              <option value="full" className="bg-[#0B1120]">
                Full Import — 50 pages, 180s timeout
              </option>
            </select>
          </div>

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
            label={
              form.importMode === "quick"
                ? "Crawling website and saving to Supabase… usually under 30 seconds."
                : "Crawling website and saving to Supabase… may take up to 3 minutes."
            }
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

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <StatCard label="Imported" value={stats.imported} tone="green" />
              <StatCard label="Updated" value={stats.updated} tone="blue" />
              <StatCard label="Skipped" value={stats.skipped} tone="neutral" />
              <StatCard
                label="Duplicates merged"
                value={stats.duplicatesMerged}
                tone="purple"
              />
              <StatCard label="Ignored" value={stats.ignored} tone="amber" />
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

          {stats.pollUpdates.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Crawl progress</CardTitle>
                <CardDescription>
                  Actor status polled every 5s — {stats.pollUpdates.length} update(s).
                </CardDescription>
              </CardHeader>
              <ul className="max-h-64 space-y-3 overflow-y-auto text-sm">
                {stats.pollUpdates.map((update) => (
                  <li
                    key={`${update.polled_at}-${update.status}`}
                    className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white/70"
                  >
                    <p>
                      <span className="text-white/90">{update.status}</span> ·{" "}
                      {update.crawled_pages} page(s) · {update.polled_at}
                    </p>
                    {update.crawl_urls.length > 0 && (
                      <p className="mt-1 break-all text-white/50">
                        {update.crawl_urls.slice(0, 3).join(" · ")}
                        {update.crawl_urls.length > 3
                          ? ` · +${update.crawl_urls.length - 3} more`
                          : ""}
                      </p>
                    )}
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
  tone: "green" | "blue" | "neutral" | "amber" | "purple";
}) {
  const toneStyles = {
    green: "border-emerald-400/20 bg-emerald-400/5 text-emerald-300",
    blue: "border-sky-400/20 bg-sky-400/5 text-sky-300",
    neutral: "border-white/10 bg-white/[0.03] text-white/70",
    amber: "border-amber-400/20 bg-amber-400/5 text-amber-300",
    purple: "border-violet-400/20 bg-violet-400/5 text-violet-300",
  };

  return (
    <div className={`rounded-xl border px-4 py-5 text-center ${toneStyles[tone]}`}>
      <p className="text-3xl font-bold tabular-nums">{value}</p>
      <p className="mt-1 text-sm opacity-80">{label}</p>
    </div>
  );
}
