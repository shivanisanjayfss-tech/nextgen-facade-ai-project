"use client";

import { useCallback, useEffect, useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { resolveApiSearchParams } from "@/lib/material-browser";
import type { MaterialSummary, SearchResult } from "@/types";

interface UseSearchOptions {
  initialQuery?: string;
  category?: string;
  debounceMs?: number;
}

async function fetchAllSearchPages(
  q?: string,
  category?: string,
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
  debounceMs = 400,
}: UseSearchOptions = {}) {
  const [query, setQuery] = useState(initialQuery);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const debouncedQuery = useDebounce(query, debounceMs);

  const search = useCallback(async (q: string, cat?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const { q: apiQuery, category: apiCategory } = resolveApiSearchParams(q, cat);
      const data = await fetchAllSearchPages(apiQuery, apiCategory);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    search(debouncedQuery, category);
  }, [debouncedQuery, category, search]);

  return { query, setQuery, result, isLoading, error, search };
}
