"use client";

import { useCallback, useEffect, useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import type { SearchResult } from "@/types";

interface UseSearchOptions {
  initialQuery?: string;
  category?: string;
  debounceMs?: number;
}

/** Client-side hook for searching materials via the /api/search endpoint. */
export function useSearch({
  initialQuery = "",
  category,
  debounceMs = 400,
}: UseSearchOptions = {}) {
  const [query, setQuery] = useState(initialQuery);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedQuery = useDebounce(query, debounceMs);

  const search = useCallback(async (q: string, cat?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (cat) params.set("category", cat);

      const response = await fetch(`/api/search?${params.toString()}`);
      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.error?.message ?? "Search failed");
      }

      setResult(json.data);
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
