import { notFound } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { DatasheetIntelligenceViewer } from "@/components/datasheets/DatasheetIntelligenceViewer";
import { createPageMetadata } from "@/lib/seo";
import { getMaterialById } from "@/services/material.service";

interface MaterialDatasheetPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: MaterialDatasheetPageProps) {
  const { id } = await params;
  const material = await getMaterialById(id);

  if (!material) {
    return createPageMetadata({ title: "Datasheet Not Found", noIndex: true });
  }

  return createPageMetadata({
    title: `${material.name} Datasheet`,
    description: `AI-extracted technical specifications for ${material.name}.`,
    path: `/materials/${material.slug}/datasheet`,
  });
}

export default async function MaterialDatasheetPage({ params }: MaterialDatasheetPageProps) {
  const { id } = await params;
  const material = await getMaterialById(id);

  if (!material) notFound();

  return (
    <AppLayout>
      <PageContainer size="xl">
        <DatasheetIntelligenceViewer
          material={material}
          backHref={`/materials/${material.slug}`}
        />
      </PageContainer>
    </AppLayout>
  );
}
