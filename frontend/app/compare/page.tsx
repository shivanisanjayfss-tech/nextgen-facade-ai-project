import { Suspense } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { ComparePageContent } from "@/components/compare/ComparePageContent";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "AI Comparison",
  description: "Compare facade materials side-by-side with AI-driven insights.",
  path: "/compare",
});

export default function ComparePage() {
  return (
    <AppLayout>
      <PageContainer>
        <Suspense
          fallback={
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          }
        >
          <ComparePageContent />
        </Suspense>
      </PageContainer>
    </AppLayout>
  );
}
