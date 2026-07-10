import { Suspense } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { SearchPageContent } from "@/components/search/SearchPageContent";
import { SearchResultSkeleton } from "@/components/ui/Skeleton";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Material Search",
  description: "Search facade materials including ACP, glass, stone, HPL, and louvers.",
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
