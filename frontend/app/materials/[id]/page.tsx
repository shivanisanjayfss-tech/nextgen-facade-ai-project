import { notFound } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { MaterialDetailView } from "@/components/materials/MaterialDetailView";
import { createPageMetadata } from "@/lib/seo";
import { getMaterialById } from "@/services/material.service";

interface MaterialPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: MaterialPageProps) {
  const { id } = await params;
  const material = await getMaterialById(id);

  if (!material) return createPageMetadata({ title: "Material Not Found", noIndex: true });

  return createPageMetadata({
    title: material.name,
    description: material.description,
    path: `/materials/${material.slug}`,
  });
}

export default async function MaterialPage({ params }: MaterialPageProps) {
  const { id } = await params;
  const material = await getMaterialById(id);

  if (!material) notFound();

  return (
    <AppLayout>
      <PageContainer size="md">
        <MaterialDetailView material={material} />
      </PageContainer>
    </AppLayout>
  );
}
