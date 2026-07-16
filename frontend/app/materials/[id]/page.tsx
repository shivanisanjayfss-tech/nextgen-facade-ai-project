import { notFound } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { MaterialDetailView } from "@/components/materials/MaterialDetailView";
import { createPageMetadata } from "@/lib/seo";
import {
  getManufacturerProductCount,
  getMaterialById,
  getRelatedMaterials,
} from "@/services/material.service";

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

  let relatedProducts: Awaited<ReturnType<typeof getRelatedMaterials>> = [];
  let manufacturerProductCount = 0;

  try {
    [relatedProducts, manufacturerProductCount] = await Promise.all([
      getRelatedMaterials(material),
      getManufacturerProductCount(material.manufacturer, material.sourceUrl),
    ]);
  } catch (error) {
    console.error("[material-page] Failed to load related products:", error);
  }

  return (
    <AppLayout>
      <PageContainer size="lg">
        <MaterialDetailView
          material={material}
          relatedProducts={relatedProducts}
          manufacturerProductCount={manufacturerProductCount}
        />
      </PageContainer>
    </AppLayout>
  );
}
