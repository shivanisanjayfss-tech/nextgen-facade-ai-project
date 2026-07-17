"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import {
  DATASHEET_FIELD_LABELS,
  DATASHEET_FIELD_ORDER,
  statusBadgeClass,
} from "@/lib/datasheet-intelligence-display";
import type { ApiResponse } from "@/types";
import type {
  ConfidentFieldValue,
  DatasheetExtractedFields,
  DatasheetIntelligence,
} from "@/types/datasheet-intelligence";

interface DatasheetReviewFormProps {
  materialId: string;
}

function toEditableValue(field: ConfidentFieldValue<string | string[]>): string {
  if (!field.value) return "";
  if (Array.isArray(field.value)) return field.value.join(", ");
  return field.value;
}

/** Admin form for manually reviewing and editing AI-extracted datasheet fields. */
export function DatasheetReviewForm({ materialId }: DatasheetReviewFormProps) {
  const [intelligence, setIntelligence] = useState<DatasheetIntelligence | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadIntelligence = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/datasheets/intelligence/${encodeURIComponent(materialId)}`,
      );
      const json = (await response.json()) as ApiResponse<DatasheetIntelligence>;

      if (!response.ok || !json.success) {
        throw new Error(json.success ? "Failed to load" : json.error.message);
      }

      setIntelligence(json.data);

      const initialDraft: Record<string, string> = {};
      for (const key of DATASHEET_FIELD_ORDER) {
        initialDraft[key] = toEditableValue(json.data.effectiveFields[key]);
      }
      setDraft(initialDraft);
    } catch (err) {
      setIntelligence(null);
      setError(err instanceof Error ? err.message : "Failed to load datasheet intelligence");
    } finally {
      setIsLoading(false);
    }
  }, [materialId]);

  useEffect(() => {
    void loadIntelligence();
  }, [loadIntelligence]);

  const saveReview = async () => {
    if (!intelligence) return;
    setIsSaving(true);
    setMessage(null);
    setError(null);

    const arrayFields = new Set(["certifications", "applications", "standards"]);
    const manualOverrides: Partial<DatasheetExtractedFields> = {};

    for (const key of DATASHEET_FIELD_ORDER) {
      const current = toEditableValue(intelligence.effectiveFields[key]);
      const next = (draft[key] ?? "").trim();
      if (next === current.trim()) continue;

      const value = arrayFields.has(key)
        ? next
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
        : next || null;

      (manualOverrides as Record<string, ConfidentFieldValue<string | string[]>>)[key] = {
        value: value as string | string[] | null,
        confidence: 1,
        manuallyEdited: true,
      };
    }

    try {
      const response = await fetch(
        `/api/datasheets/intelligence/${encodeURIComponent(materialId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ manualOverrides }),
        },
      );
      const json = (await response.json()) as ApiResponse<DatasheetIntelligence>;

      if (!response.ok || !json.success) {
        throw new Error(json.success ? "Save failed" : json.error.message);
      }

      setIntelligence(json.data);
      setMessage("Manual review saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save review");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <LoadingSpinner size="lg" label="Loading review form…" className="py-8" />
      </Card>
    );
  }

  if (error && !intelligence) {
    return <ErrorMessage message={error} onRetry={() => void loadIntelligence()} />;
  }

  if (!intelligence) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Datasheet Review"
        description="Edit AI-extracted values. Overrides are stored separately and marked as manually reviewed."
        action={
          <div className="flex gap-2">
            <Link href={`/materials/${materialId}/datasheet`}>
              <Button variant="outline" size="sm">
                View Datasheet
              </Button>
            </Link>
            <Button variant="primary" size="sm" onClick={() => void saveReview()} disabled={isSaving}>
              {isSaving ? "Saving…" : "Save Review"}
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
          <CardDescription>Material {intelligence.materialId.slice(0, 8)}</CardDescription>
        </CardHeader>
        <div className="px-6 pb-6">
          <span
            className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${statusBadgeClass(intelligence.status)}`}
          >
            {intelligence.status}
          </span>
        </div>
      </Card>

      {message && (
        <p className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3 text-sm text-emerald-200">
          {message}
        </p>
      )}
      {error && <ErrorMessage message={error} />}

      <Card>
        <CardHeader>
          <CardTitle>Field Overrides</CardTitle>
          <CardDescription>
            Comma-separate list values for certifications, applications, and standards.
          </CardDescription>
        </CardHeader>
        <div className="grid gap-4 px-6 pb-6 sm:grid-cols-2">
          {DATASHEET_FIELD_ORDER.map((fieldKey) => (
            <label key={fieldKey} className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-white/45">
                {DATASHEET_FIELD_LABELS[fieldKey]}
              </span>
              <input
                type="text"
                value={draft[fieldKey] ?? ""}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, [fieldKey]: event.target.value }))
                }
                className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-sky-400/40"
              />
            </label>
          ))}
        </div>
      </Card>
    </div>
  );
}
