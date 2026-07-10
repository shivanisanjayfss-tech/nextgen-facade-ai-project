"use client";

import { useCallback, useState } from "react";
import type { ComparisonResult } from "@/types";

/** Client-side hook for comparing materials via the /api/compare endpoint. */
export function useCompare() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleMaterial = useCallback((id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((i) => i !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  }, []);

  const compare = useCallback(async (ids?: string[]) => {
    const materialIds = ids ?? selectedIds;
    if (ids) setSelectedIds(ids);

    if (materialIds.length < 2) {
      setError("Select at least 2 materials to compare");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ materialIds }),
      });

      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.error?.message ?? "Comparison failed");
      }

      setResult(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Comparison failed");
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  }, [selectedIds]);

  const clear = useCallback(() => {
    setSelectedIds([]);
    setResult(null);
    setError(null);
  }, []);

  return {
    selectedIds,
    toggleMaterial,
    compare,
    clear,
    result,
    isLoading,
    error,
  };
}
