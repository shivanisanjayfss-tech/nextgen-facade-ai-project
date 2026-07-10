"use client";

import { MaterialCard } from "@/components/search/MaterialCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { SearchResultSkeleton } from "@/components/ui/Skeleton";
import type { SearchResult } from "@/types";

interface SearchResultsProps {
  result: SearchResult | null;
  isLoading: boolean;
  error: string | null;
  onRetry?: () => void;
}

/** Renders search results with loading, error, and empty states. */
export function SearchResults({ result, isLoading, error, onRetry }: SearchResultsProps) {
  if (isLoading) return <SearchResultSkeleton />;

  if (error) {
    return <ErrorMessage message={error} onRetry={onRetry} />;
  }

  if (!result || result.items.length === 0) {
    return (
      <EmptyState
        title="No materials found"
        description="Try adjusting your search terms or browse all categories."
        icon={
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
        }
      />
    );
  }

  return (
    <div>
      <p className="mb-4 text-sm text-white/40">
        {result.total} material{result.total !== 1 ? "s" : ""} found
        {result.query && (
          <> for &ldquo;<span className="text-white/60">{result.query}</span>&rdquo;</>
        )}
      </p>
      <div className="space-y-3">
        {result.items.map((material) => (
          <MaterialCard key={material.id} material={material} />
        ))}
      </div>
    </div>
  );
}
