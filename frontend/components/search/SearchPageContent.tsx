"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/PageContainer";
import { SearchFilters } from "@/components/search/SearchFilters";
import { SearchResults } from "@/components/search/SearchResults";
import { SearchBar } from "@/components/ui/SearchBar";
import { useSearch } from "@/hooks/useSearch";

/** Client-side search page content (requires Suspense for useSearchParams). */
export function SearchPageContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";
  const [category, setCategory] = useState<string | undefined>(
    searchParams.get("category") ?? undefined,
  );

  const { query, setQuery, result, isLoading, error, search } = useSearch({
    initialQuery,
    category,
  });

  useEffect(() => {
    setQuery(searchParams.get("q") ?? "");
    setCategory(searchParams.get("category") ?? undefined);
  }, [searchParams, setQuery]);

  return (
    <>
      <PageHeader
        title="Materials"
        description="Browse facade products by category and manufacturer — structured for specification and comparison."
      />
      <div className="mb-6">
        <SearchBar
          size="md"
          showShortcut={false}
          value={query}
          onValueChange={setQuery}
        />
      </div>
      <div className="mb-8">
        <SearchFilters activeCategory={category} onCategoryChange={setCategory} />
      </div>
      <SearchResults
        result={result}
        isLoading={isLoading}
        error={error}
        activeCategory={category}
        onRetry={() => search(query, category)}
      />
    </>
  );
}
