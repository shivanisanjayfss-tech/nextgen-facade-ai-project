import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer, PageHeader } from "@/components/layout/PageContainer";
import { DatasheetList } from "@/components/datasheets/DatasheetCard";
import { createPageMetadata } from "@/lib/seo";
import { getDatasheets } from "@/services/datasheet.service";

export const metadata = createPageMetadata({
  title: "Technical Datasheets",
  description: "Access fire ratings, thermal properties, and manufacturer specifications.",
  path: "/datasheets",
});

export default async function DatasheetsPage() {
  const datasheets = await getDatasheets();

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader
          title="Technical Datasheets"
          description="Fire ratings, thermal properties, wind loads, and manufacturer specs."
        />
        <DatasheetList datasheets={datasheets} />
      </PageContainer>
    </AppLayout>
  );
}
