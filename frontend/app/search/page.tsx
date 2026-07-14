import { Suspense } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { SearchPageContent } from "@/components/search/SearchPageContent";
import { SearchResultSkeleton } from "@/components/ui/Skeleton";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Materials",
  description: "Browse facade materials by category and manufacturer — ACP Sheet, glass, stone, HPL, and more.",
  path: "/search",
});

export default function SearchPage() {
  return (
    <AppLayout>
      <PageContainer>
        <Suspense fallback={<SearchResultSkeleton />}>
          <SearchPageContent />
        </Suspense>
      </PageContainer>
    </AppLayout>
  );
}
