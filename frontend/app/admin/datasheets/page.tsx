import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { DatasheetIntelligenceAdmin } from "@/components/admin/DatasheetIntelligenceAdmin";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Datasheet Intelligence",
  description: "Review AI-extracted datasheet specifications and processing status.",
  path: "/admin/datasheets",
});

export default function AdminDatasheetsPage() {
  return (
    <AppLayout>
      <PageContainer size="xl">
        <DatasheetIntelligenceAdmin />
      </PageContainer>
    </AppLayout>
  );
}
