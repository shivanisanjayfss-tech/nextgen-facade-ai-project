"use client";

import { useState } from "react";
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

  return (
    <>
      <PageHeader
        title="Material Search"
        description="Search across ACP, glass, stone, HPL, louvers, and more."
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
        onRetry={() => search(query, category)}
      />
    </>
  );
}
