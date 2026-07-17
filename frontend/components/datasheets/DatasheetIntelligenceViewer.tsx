"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import {
  DATASHEET_FIELD_LABELS,
  DATASHEET_FIELD_ORDER,
  confidenceBadgeClass,
  formatConfidence,
  formatFieldValue,
  statusBadgeClass,
} from "@/lib/datasheet-intelligence-display";
import type { ApiResponse } from "@/types";
import type { DatasheetIntelligence } from "@/types/datasheet-intelligence";
import type { Material } from "@/types/material";

interface DatasheetIntelligenceViewerProps {
  material: Material;
  backHref?: string;
  showReviewLink?: boolean;
}

/** Displays PDF, AI-extracted specs, summary, and technical highlights. */
export function DatasheetIntelligenceViewer({
  material,
  backHref,
  showReviewLink = false,
}: DatasheetIntelligenceViewerProps) {
  const [intelligence, setIntelligence] = useState<DatasheetIntelligence | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadIntelligence = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/datasheets/intelligence/${encodeURIComponent(material.id)}`,
      );

      if (response.status === 404) {
        setIntelligence(null);
        return;
      }

      const json = (await response.json()) as ApiResponse<DatasheetIntelligence>;
      if (!response.ok || !json.success) {
        throw new Error(json.success ? "Failed to load datasheet intelligence" : json.error.message);
      }

      setIntelligence(json.data);
    } catch (err) {
      setIntelligence(null);
      setError(err instanceof Error ? err.message : "Failed to load datasheet intelligence");
    } finally {
      setIsLoading(false);
    }
  }, [material.id]);

  useEffect(() => {
    void loadIntelligence();
  }, [loadIntelligence]);

  const processDatasheet = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch("/api/datasheets/intelligence/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ materialId: material.id }),
      });
      const json = (await response.json()) as ApiResponse<{
        results: Array<{ status: string; errorMessage?: string | null }>;
      }>;

      if (!response.ok || !json.success) {
        throw new Error(json.success ? "Processing failed" : json.error.message);
      }

      const result = json.data.results[0];
      if (result?.status === "failed") {
        throw new Error(result.errorMessage ?? "Datasheet processing failed.");
      }

      await loadIntelligence();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Datasheet processing failed");
    } finally {
      setIsProcessing(false);
    }
  };

  const pdfUrl = intelligence?.sourceUrl ?? material.datasheetUrl;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Datasheet Intelligence
          </h1>
          <p className="mt-2 text-sm text-white/50">
            {material.name} · {material.manufacturer}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {backHref && (
            <Link href={backHref}>
              <Button variant="outline" size="sm">
                ← Back
              </Button>
            </Link>
          )}
          {showReviewLink && (
            <Link href={`/admin/datasheets/${material.id}`}>
              <Button variant="outline" size="sm">
                Review & Edit
              </Button>
            </Link>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadIntelligence()}
            disabled={isLoading}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => void processDatasheet()}
            disabled={isProcessing || !material.datasheetUrl}
          >
            {isProcessing ? "Processing…" : "Process Datasheet"}
          </Button>
        </div>
      </div>

      {isLoading && (
        <Card>
          <LoadingSpinner size="lg" label="Loading datasheet intelligence…" className="py-8" />
        </Card>
      )}

      {error && !isLoading && <ErrorMessage message={error} onRetry={() => void loadIntelligence()} />}

      {!isLoading && !intelligence && !error && (
        <Card>
          <CardHeader>
            <CardTitle>Not processed yet</CardTitle>
            <CardDescription>
              {material.datasheetUrl
                ? "This material has a datasheet URL. Run processing to extract AI specifications."
                : "No datasheet URL is linked to this material."}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {!isLoading && intelligence && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Processing Status</CardTitle>
              <CardDescription>
                Extraction pipeline status and page coverage.
              </CardDescription>
            </CardHeader>
            <div className="flex flex-wrap gap-3 px-6 pb-6">
              <span
                className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${statusBadgeClass(intelligence.status)}`}
              >
                {intelligence.status}
              </span>
              {intelligence.extractionStatus && (
                <span className="inline-flex rounded-full border border-white/10 px-2.5 py-0.5 text-xs text-white/50">
                  {intelligence.extractionStatus}
                </span>
              )}
              {intelligence.pageCount != null && (
                <span className="text-xs text-white/50">{intelligence.pageCount} pages</span>
              )}
              {intelligence.processedAt && (
                <span className="text-xs text-white/40">
                  Processed {new Date(intelligence.processedAt).toLocaleString()}
                </span>
              )}
            </div>
            {intelligence.errorMessage && (
              <p className="mx-6 mb-6 rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm text-red-200">
                {intelligence.errorMessage}
              </p>
            )}
          </Card>

          {pdfUrl && (
            <Card>
              <CardHeader>
                <CardTitle>Original PDF</CardTitle>
                <CardDescription>
                  Embedded datasheet from the manufacturer source.
                </CardDescription>
              </CardHeader>
              <div className="px-6 pb-6">
                <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
                  <iframe
                    src={pdfUrl}
                    title={`${material.name} datasheet`}
                    className="h-[70vh] w-full"
                  />
                </div>
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block text-sm text-sky-300 hover:underline"
                >
                  Open PDF in new tab
                </a>
              </div>
            </Card>
          )}

          <div className="grid gap-8 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>AI Summary</CardTitle>
              </CardHeader>
              <p className="px-6 pb-6 text-sm leading-relaxed text-white/75">
                {intelligence.aiSummary ?? "No summary available."}
              </p>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Technical Highlights</CardTitle>
              </CardHeader>
              {intelligence.technicalHighlights.length > 0 ? (
                <ul className="space-y-2 px-6 pb-6 text-sm text-white/70">
                  {intelligence.technicalHighlights.map((highlight) => (
                    <li key={highlight} className="flex gap-2">
                      <span className="text-sky-300">•</span>
                      <span>{highlight}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-6 pb-6 text-sm text-white/50">No highlights recorded.</p>
              )}
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Extracted Specifications</CardTitle>
              <CardDescription>
                AI-extracted fields with confidence scores. Manually reviewed values are marked.
              </CardDescription>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-white/50">
                    <th className="px-6 py-3 font-medium">Field</th>
                    <th className="px-6 py-3 font-medium">Value</th>
                    <th className="px-6 py-3 font-medium text-right">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {DATASHEET_FIELD_ORDER.map((fieldKey) => {
                    const field = intelligence.effectiveFields[fieldKey];
                    return (
                      <tr key={fieldKey} className="border-b border-white/5 align-top">
                        <td className="px-6 py-4 font-medium text-white/80">
                          {DATASHEET_FIELD_LABELS[fieldKey]}
                          {field.manuallyEdited && (
                            <span className="ml-2 text-xs text-sky-300">(edited)</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-white/70">
                          {formatFieldValue(field.value)}
                          {field.sourcePage != null && (
                            <p className="mt-1 text-xs text-white/35">Page {field.sourcePage}</p>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${confidenceBadgeClass(field.confidence)}`}
                          >
                            {formatConfidence(field.confidence)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
