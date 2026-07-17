"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/PageContainer";
import {
  DatasheetIntelligenceFilters,
  type DatasheetSearchFiltersState,
} from "@/components/search/DatasheetIntelligenceFilters";
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
  const [datasheetFilters, setDatasheetFilters] = useState<DatasheetSearchFiltersState>({
    fireRating: searchParams.get("fireRating") ?? undefined,
    thickness: searchParams.get("thickness") ?? undefined,
    finish: searchParams.get("finish") ?? undefined,
    thermalValue: searchParams.get("thermalValue") ?? undefined,
    certification: searchParams.get("certification") ?? undefined,
  });

  const { query, setQuery, result, isLoading, error, search } = useSearch({
    initialQuery,
    category,
    datasheetFilters,
  });

  useEffect(() => {
    setQuery(searchParams.get("q") ?? "");
    setCategory(searchParams.get("category") ?? undefined);
    setDatasheetFilters({
      fireRating: searchParams.get("fireRating") ?? undefined,
      thickness: searchParams.get("thickness") ?? undefined,
      finish: searchParams.get("finish") ?? undefined,
      thermalValue: searchParams.get("thermalValue") ?? undefined,
      certification: searchParams.get("certification") ?? undefined,
    });
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
      <div className="mb-6">
        <SearchFilters activeCategory={category} onCategoryChange={setCategory} />
      </div>
      <div className="mb-8">
        <DatasheetIntelligenceFilters
          filters={datasheetFilters}
          onChange={setDatasheetFilters}
        />
      </div>
      <SearchResults
        result={result}
        isLoading={isLoading}
        error={error}
        activeCategory={category}
        onRetry={() => search(query, category, datasheetFilters)}
      />
    </>
  );
}
