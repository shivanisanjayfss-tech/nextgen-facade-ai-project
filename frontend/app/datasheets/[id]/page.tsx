import { notFound } from "next/navigation";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { createPageMetadata } from "@/lib/seo";
import { formatDate } from "@/lib/utils";
import { getDatasheetById } from "@/services/datasheet.service";
import { getMaterialById } from "@/services/material.service";

interface DatasheetPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: DatasheetPageProps) {
  const { id } = await params;
  const datasheet = await getDatasheetById(id);

  if (!datasheet) return createPageMetadata({ title: "Datasheet Not Found", noIndex: true });

  return createPageMetadata({
    title: datasheet.title,
    description: `Technical datasheet for ${datasheet.manufacturer} ${datasheet.category} material.`,
    path: `/datasheets/${datasheet.id}`,
  });
}

export default async function DatasheetDetailPage({ params }: DatasheetPageProps) {
  const { id } = await params;
  const datasheet = await getDatasheetById(id);

  if (!datasheet) notFound();

  const material = await getMaterialById(datasheet.materialId);

  return (
    <AppLayout>
      <PageContainer size="md">
        <Link href="/datasheets">
          <Button variant="ghost" size="sm" className="mb-6">
            ← Back to Datasheets
          </Button>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="category">{datasheet.category}</Badge>
          {datasheet.version && <Badge variant="tag">{datasheet.version}</Badge>}
        </div>

        <h1 className="mt-4 text-3xl font-bold tracking-tight text-white">{datasheet.title}</h1>
        <p className="mt-2 text-lg text-white/50">{datasheet.manufacturer}</p>

        <Card className="mt-8">
          <div className="divide-y divide-white/[0.06]">
            {[
              { label: "Published", value: formatDate(datasheet.publishedAt) },
              { label: "File Size", value: datasheet.fileSize ?? "—" },
              { label: "Pages", value: datasheet.pages?.toString() ?? "—" },
              { label: "Version", value: datasheet.version ?? "—" },
            ].map((row) => (
              <div key={row.label} className="flex justify-between py-3 text-sm">
                <span className="text-white/50">{row.label}</span>
                <span className="text-white/80">{row.value}</span>
              </div>
            ))}
          </div>
        </Card>

        <div className="mt-6 flex flex-wrap gap-3">
          {material && (
            <Link href={`/materials/${material.slug}`}>
              <Button variant="primary">View Material</Button>
            </Link>
          )}
          <Button variant="outline" disabled>
            Download PDF (Coming Soon)
          </Button>
        </div>
      </PageContainer>
    </AppLayout>
  );
}
