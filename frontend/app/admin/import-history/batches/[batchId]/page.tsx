import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { ImportBatchDetailsView } from "@/components/admin/import-history/ImportBatchDetailsView";
import { createPageMetadata } from "@/lib/seo";

interface ImportBatchDetailsPageProps {
  params: Promise<{ batchId: string }>;
}

export async function generateMetadata({ params }: ImportBatchDetailsPageProps) {
  const { batchId } = await params;

  return createPageMetadata({
    title: "Batch Run Details",
    description: `Scheduler batch import run ${batchId}.`,
    path: `/admin/import-history/batches/${batchId}`,
  });
}

export default async function ImportBatchDetailsPage({ params }: ImportBatchDetailsPageProps) {
  const { batchId } = await params;

  return (
    <AppLayout>
      <PageContainer size="xl">
        <ImportBatchDetailsView batchId={batchId} />
      </PageContainer>
    </AppLayout>
  );
}
