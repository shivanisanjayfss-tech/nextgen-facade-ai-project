"use client";

import { useCallback, useEffect, useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { resolveApiSearchParams } from "@/lib/material-browser";
import type { DatasheetSearchFiltersState } from "@/components/search/DatasheetIntelligenceFilters";
import type { MaterialSummary, SearchResult } from "@/types";

interface UseSearchOptions {
  initialQuery?: string;
  category?: string;
  datasheetFilters?: DatasheetSearchFiltersState;
  debounceMs?: number;
}

async function fetchAllSearchPages(
  q?: string,
  category?: string,
  datasheetFilters?: DatasheetSearchFiltersState,
): Promise<SearchResult> {
  const limit = 50;
  let page = 1;
  const allItems: MaterialSummary[] = [];
  let total = 0;
  let query = q ?? "";

  while (true) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    if (datasheetFilters?.fireRating) params.set("fireRating", datasheetFilters.fireRating);
    if (datasheetFilters?.thickness) params.set("thickness", datasheetFilters.thickness);
    if (datasheetFilters?.finish) params.set("finish", datasheetFilters.finish);
    if (datasheetFilters?.thermalValue) params.set("thermalValue", datasheetFilters.thermalValue);
    if (datasheetFilters?.certification) params.set("certification", datasheetFilters.certification);
    params.set("page", String(page));
    params.set("limit", String(limit));

    const response = await fetch(`/api/search?${params.toString()}`);
    const json = await response.json();

    if (!response.ok || !json.success) {
      throw new Error(json.error?.message ?? "Search failed");
    }

    const data = json.data as SearchResult;
    allItems.push(...data.items);
    total = data.total;
    query = data.query;

    if (allItems.length >= total || data.items.length === 0) {
      break;
    }

    const nextFrom = page * limit;
    if (nextFrom >= total) {
      break;
    }

    page += 1;
  }

  return {
    items: allItems,
    total,
    page: 1,
    limit: allItems.length,
    query,
  };
}

/** Client-side hook for searching materials via the /api/search endpoint. */
export function useSearch({
  initialQuery = "",
  category,
  datasheetFilters,
  debounceMs = 400,
}: UseSearchOptions = {}) {
  const [query, setQuery] = useState(initialQuery);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const debouncedQuery = useDebounce(query, debounceMs);
  const debouncedFilters = useDebounce(datasheetFilters, debounceMs);

  const search = useCallback(
    async (q: string, cat?: string, filters?: DatasheetSearchFiltersState) => {
      setIsLoading(true);
      setError(null);

      try {
        const { q: apiQuery, category: apiCategory } = resolveApiSearchParams(q, cat);
        const data = await fetchAllSearchPages(apiQuery, apiCategory, filters);
        setResult(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed");
        setResult(null);
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    search(debouncedQuery, category, debouncedFilters);
  }, [debouncedQuery, category, debouncedFilters, search]);

  return { query, setQuery, result, isLoading, error, search };
}
