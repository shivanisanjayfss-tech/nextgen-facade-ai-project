"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { CompareView } from "@/components/compare/CompareView";
import { PageHeader } from "@/components/layout/PageContainer";
import { useCompare } from "@/hooks/useCompare";
import { MOCK_MATERIALS } from "@/lib/mock-data";

/** Client-side compare page content. */
export function ComparePageContent() {
  const searchParams = useSearchParams();
  const initialCompareDone = useRef(false);
  const {
    selectedIds,
    toggleMaterial,
    compare,
    clear,
    result,
    isLoading,
    error,
  } = useCompare();

  const materials = MOCK_MATERIALS.map((m) => ({
    id: m.id,
    name: m.name,
    slug: m.slug,
    category: m.category,
    manufacturer: m.manufacturer,
    description: m.description,
    imageUrl: m.imageUrl,
    tags: m.tags,
  }));

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
        result={result}
        isLoading={isLoading}
        error={error}
      />
    </>
  );
}
