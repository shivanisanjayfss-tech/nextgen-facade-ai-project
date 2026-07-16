import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { ImportRunDetailsView } from "@/components/admin/ImportRunDetailsView";
import { createPageMetadata } from "@/lib/seo";

interface ImportRunDetailsPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ImportRunDetailsPageProps) {
  const { id } = await params;

  return createPageMetadata({
    title: "Import Run Details",
    description: `Per-product results for import run ${id}.`,
    path: `/admin/import-history/${id}`,
  });
}

export default async function ImportRunDetailsPage({ params }: ImportRunDetailsPageProps) {
  const { id } = await params;

  return (
    <AppLayout>
      <PageContainer size="xl">
        <ImportRunDetailsView runId={id} />
      </PageContainer>
    </AppLayout>
  );
}
