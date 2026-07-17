import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { DatasheetReviewForm } from "@/components/admin/DatasheetReviewForm";
import { createPageMetadata } from "@/lib/seo";

interface AdminDatasheetReviewPageProps {
  params: Promise<{ materialId: string }>;
}

export async function generateMetadata({ params }: AdminDatasheetReviewPageProps) {
  const { materialId } = await params;

  return createPageMetadata({
    title: "Review Datasheet",
    description: `Manual review for datasheet intelligence ${materialId}.`,
    path: `/admin/datasheets/${materialId}`,
  });
}

export default async function AdminDatasheetReviewPage({
  params,
}: AdminDatasheetReviewPageProps) {
  const { materialId } = await params;

  return (
    <AppLayout>
      <PageContainer size="xl">
        <DatasheetReviewForm materialId={materialId} />
      </PageContainer>
    </AppLayout>
  );
}
