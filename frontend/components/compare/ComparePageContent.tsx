"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { CompareView } from "@/components/compare/CompareView";
import { PageHeader } from "@/components/layout/PageContainer";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useCompare } from "@/hooks/useCompare";
import { useSearch } from "@/hooks/useSearch";

/** Client-side compare page content. */
export function ComparePageContent() {
  const searchParams = useSearchParams();
  const initialCompareDone = useRef(false);
  const {
    selectedIds,
    toggleMaterial,
    compare,
    clear,
    result: compareResult,
    isLoading,
    error,
  } = useCompare();

  const {
    result: searchResult,
    isLoading: isLoadingMaterials,
    error: materialsError,
  } = useSearch({
    initialQuery: "",
    debounceMs: 0,
  });

  const materials = searchResult?.items ?? [];

  useEffect(() => {
    if (initialCompareDone.current) return;
    const idsParam = searchParams.get("ids");
    if (idsParam) {
      const ids = idsParam.split(",").filter(Boolean);
      if (ids.length >= 2) {
        initialCompareDone.current = true;
        compare(ids);
      }
    }
  }, [searchParams, compare]);

  return (
    <>
      <PageHeader
        title="AI Comparison"
        description="Select materials to compare performance, fire ratings, and specifications."
      />
      <CompareView
        materials={materials}
        selectedIds={selectedIds}
        onToggle={toggleMaterial}
        onCompare={() => compare()}
        onClear={clear}
        result={compareResult}
        isLoading={isLoading || isLoadingMaterials}
        error={error ?? materialsError}
      />
      {isLoadingMaterials && materials.length === 0 && (
        <LoadingSpinner size="md" label="Loading products…" className="mt-6" />
      )}
    </>
  );
}
