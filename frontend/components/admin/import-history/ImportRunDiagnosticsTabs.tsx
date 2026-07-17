"use client";

import { useMemo, useState } from "react";
import { FilterChip } from "@/components/admin/import-history/FilterChip";
import { StructuredLogsTable } from "@/components/admin/import-history/StructuredLogsTable";
import { formatImportDate } from "@/lib/import-history-display";
import type {
  MaterialPersistDecision,
  MaterialPersistOutcome,
} from "@/types/import";
import type { ImportRunEventRow } from "@/types/import-diagnostics";
import type { ImportHistoryRow } from "@/types/import-history";

type DetailsTab =
  | "products"
  | "timeline"
  | "ignored"
  | "urls"
  | "logs";

type OutcomeFilter = "all" | MaterialPersistOutcome;

const OUTCOME_STYLES: Record<MaterialPersistOutcome, string> = {
  imported: "text-emerald-300 bg-emerald-400/10 border-emerald-400/20",
  updated: "text-sky-300 bg-sky-400/10 border-sky-400/20",
  skipped: "text-amber-300 bg-amber-400/10 border-amber-400/20",
  failed: "text-red-300 bg-red-400/10 border-red-400/20",
};

const OUTCOME_LABELS: Record<MaterialPersistOutcome, string> = {
  imported: "Imported",
  updated: "Updated",
  skipped: "Skipped",
  failed: "Failed",
};

function formatChangedFields(decision: MaterialPersistDecision): string {
  if (decision.changedFields.length === 0) return "—";
  return decision.changedFields
    .map((change) => `${change.field}: ${change.previous} → ${change.next}`)
    .join("; ");
}

interface ImportRunDiagnosticsTabsProps {
  run: ImportHistoryRow;
  events: ImportRunEventRow[];
}

/** Tabbed diagnostics panels for a single manufacturer import run. */
export function ImportRunDiagnosticsTabs({ run, events }: ImportRunDiagnosticsTabsProps) {
  const [activeTab, setActiveTab] = useState<DetailsTab>("products");
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>("all");

  const decisions = run.product_decisions ?? [];
  const diagnostics = run.diagnostics ?? {};

  const outcomeCounts = useMemo(() => {
    const counts: Record<MaterialPersistOutcome, number> = {
      imported: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
    };
    for (const decision of decisions) {
      counts[decision.outcome] += 1;
    }
    return counts;
  }, [decisions]);

  const filteredDecisions = useMemo(() => {
    if (outcomeFilter === "all") return decisions;
    return decisions.filter((decision) => decision.outcome === outcomeFilter);
  }, [decisions, outcomeFilter]);

  const pollUpdates = diagnostics.poll_updates ?? [];
  const ignoredPages = diagnostics.ignored_pages ?? [];
  const crawlUrls = diagnostics.crawl_urls ?? [];
  const discoveredUrls = diagnostics.discovered_product_urls ?? [];
  const startUrls = diagnostics.crawl_start_urls ?? [];

  const tabs: Array<{ id: DetailsTab; label: string; count?: number }> = [
    { id: "products", label: "Products", count: decisions.length },
    { id: "timeline", label: "Crawl Timeline", count: pollUpdates.length },
    { id: "logs", label: "Structured Logs", count: events.length },
    { id: "ignored", label: "Ignored Pages", count: ignoredPages.length },
    {
      id: "urls",
      label: "Crawl URLs",
      count: crawlUrls.length + discoveredUrls.length + startUrls.length,
    },
  ];

  return (
    <div>
      <div className="flex flex-wrap gap-2 border-b border-white/10 px-6 pb-4">
        {tabs.map((tab) => (
          <FilterChip
            key={tab.id}
            label={tab.count !== undefined ? `${tab.label} (${tab.count})` : tab.label}
            active={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          />
        ))}
      </div>

      <div className="px-6 py-4">
        {activeTab === "products" && (
          <ProductsTab
            run={run}
            decisions={decisions}
            filteredDecisions={filteredDecisions}
            outcomeCounts={outcomeCounts}
            outcomeFilter={outcomeFilter}
            onOutcomeFilterChange={setOutcomeFilter}
          />
        )}

        {activeTab === "timeline" && (
          <TimelineTab pollUpdates={pollUpdates} apifyRunUrl={run.apify_run_url} />
        )}

        {activeTab === "logs" && (
          <StructuredLogsTable events={events} showStageCoverage />
        )}

        {activeTab === "ignored" && <IgnoredPagesTab pages={ignoredPages} notes={diagnostics.notes} />}

        {activeTab === "urls" && (
          <UrlsTab
            startUrls={startUrls}
            crawlUrls={crawlUrls}
            discoveredUrls={discoveredUrls}
          />
        )}
      </div>
    </div>
  );
}

function ProductsTab({
  run,
  decisions,
  filteredDecisions,
  outcomeCounts,
  outcomeFilter,
  onOutcomeFilterChange,
}: {
  run: ImportHistoryRow;
  decisions: MaterialPersistDecision[];
  filteredDecisions: MaterialPersistDecision[];
  outcomeCounts: Record<MaterialPersistOutcome, number>;
  outcomeFilter: OutcomeFilter;
  onOutcomeFilterChange: (value: OutcomeFilter) => void;
}) {
  if (decisions.length === 0) {
    return (
      <p className="text-sm text-white/50">
        No per-product decisions stored. Totals: imported {run.imported}, updated {run.updated},
        skipped {run.skipped}, failed {run.failed}.
      </p>
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <FilterChip
          label={`All (${decisions.length})`}
          active={outcomeFilter === "all"}
          onClick={() => onOutcomeFilterChange("all")}
        />
        {(Object.keys(OUTCOME_LABELS) as MaterialPersistOutcome[]).map((outcome) => (
          <FilterChip
            key={outcome}
            label={`${OUTCOME_LABELS[outcome]} (${outcomeCounts[outcome]})`}
            active={outcomeFilter === outcome}
            onClick={() => onOutcomeFilterChange(outcome)}
          />
        ))}
      </div>

      {filteredDecisions.length === 0 ? (
        <p className="text-sm text-white/50">No products match the selected filter.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-white/50">
                <th className="py-3 pr-4 font-medium">Product</th>
                <th className="py-3 pr-4 font-medium">Status</th>
                <th className="py-3 pr-4 font-medium">Reasons</th>
                <th className="py-3 pr-4 font-medium">Match</th>
                <th className="py-3 pr-4 font-medium">Changed fields</th>
                <th className="py-3 font-medium">Error</th>
              </tr>
            </thead>
            <tbody>
              {filteredDecisions.map((decision) => (
                <tr
                  key={`${decision.slug}-${decision.sourceUrl}`}
                  className="border-b border-white/5 align-top text-white/70"
                >
                  <td className="py-4 pr-4">
                    <p className="font-medium text-white">{decision.productName}</p>
                    <p className="mt-1 text-xs text-white/40">{decision.slug}</p>
                    {decision.sourceUrl && (
                      <a
                        href={decision.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 block max-w-xs truncate text-xs text-sky-300 hover:underline"
                      >
                        {decision.sourceUrl}
                      </a>
                    )}
                  </td>
                  <td className="py-4 pr-4">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${OUTCOME_STYLES[decision.outcome]}`}
                    >
                      {OUTCOME_LABELS[decision.outcome]}
                    </span>
                  </td>
                  <td className="py-4 pr-4">
                    <ul className="space-y-1">
                      {(decision.statusReasons.length > 0
                        ? decision.statusReasons
                        : [decision.reason]
                      ).map((reason) => (
                        <li key={reason} className="text-xs text-white/60">
                          {reason}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="py-4 pr-4 text-xs text-white/50">{decision.matchKind}</td>
                  <td className="py-4 pr-4 text-xs text-white/50">
                    {formatChangedFields(decision)}
                  </td>
                  <td className="py-4 text-xs text-red-200">{decision.errorMessage ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function TimelineTab({
  pollUpdates,
  apifyRunUrl,
}: {
  pollUpdates: NonNullable<ImportHistoryRow["diagnostics"]>["poll_updates"];
  apifyRunUrl?: string | null;
}) {
  const pollRows = pollUpdates ?? [];

  if (pollRows.length === 0 && !apifyRunUrl) {
    return <p className="text-sm text-white/50">No crawl timeline data recorded for this run.</p>;
  }

  return (
    <div className="space-y-6">
      {apifyRunUrl && (
        <p className="text-sm text-white/60">
          Apify run:{" "}
          <a
            href={apifyRunUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sky-300 hover:underline"
          >
            {apifyRunUrl}
          </a>
        </p>
      )}

      {pollRows.length > 0 ? (
        <section>
          <h3 className="mb-3 text-sm font-medium text-white">Apify poll updates</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-white/50">
                  <th className="py-2 pr-4 font-medium">Time</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium text-right">Pages</th>
                  <th className="py-2 font-medium text-right">URLs seen</th>
                </tr>
              </thead>
              <tbody>
                {pollRows.map((update, index) => (
                  <tr key={`${update.polled_at}-${index}`} className="border-b border-white/5">
                    <td className="py-2 pr-4 text-white/70">
                      {formatImportDate(update.polled_at)}
                    </td>
                    <td className="py-2 pr-4 uppercase text-white/60">{update.status}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{update.crawled_pages}</td>
                    <td className="py-2 text-right tabular-nums">
                      {update.crawl_urls?.length ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <p className="text-sm text-white/50">No Apify poll updates recorded.</p>
      )}
    </div>
  );
}

function IgnoredPagesTab({
  pages,
  notes,
}: {
  pages: NonNullable<ImportHistoryRow["diagnostics"]>["ignored_pages"];
  notes?: string[];
}) {
  const ignored = pages ?? [];

  if (ignored.length === 0 && !(notes?.length ?? 0)) {
    return <p className="text-sm text-white/50">No ignored pages recorded.</p>;
  }

  return (
    <div className="space-y-4">
      {notes && notes.length > 0 && (
        <ul className="space-y-1 text-sm text-white/60">
          {notes.map((note) => (
            <li key={note}>• {note}</li>
          ))}
        </ul>
      )}

      {ignored.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-white/50">
                <th className="py-2 pr-4 font-medium">URL</th>
                <th className="py-2 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody>
              {ignored.map((page) => (
                <tr key={page.url} className="border-b border-white/5">
                  <td className="py-2 pr-4">
                    <a
                      href={page.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-300 hover:underline"
                    >
                      {page.url}
                    </a>
                  </td>
                  <td className="py-2 text-white/60">{page.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function UrlsTab({
  startUrls,
  crawlUrls,
  discoveredUrls,
}: {
  startUrls: string[];
  crawlUrls: string[];
  discoveredUrls: string[];
}) {
  const sections = [
    { title: "Start URLs", urls: startUrls },
    { title: "Crawled URLs", urls: crawlUrls },
    { title: "Discovered product URLs", urls: discoveredUrls },
  ].filter((section) => section.urls.length > 0);

  if (sections.length === 0) {
    return <p className="text-sm text-white/50">No crawl URLs recorded.</p>;
  }

  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <section key={section.title}>
          <h3 className="mb-2 text-sm font-medium text-white">
            {section.title} ({section.urls.length})
          </h3>
          <ul className="max-h-72 space-y-1 overflow-y-auto text-sm">
            {section.urls.map((url) => (
              <li key={url}>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-300 hover:underline"
                >
                  {url}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
