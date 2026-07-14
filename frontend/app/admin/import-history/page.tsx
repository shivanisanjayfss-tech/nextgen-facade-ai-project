import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { ImportHistoryDashboard } from "@/components/admin/ImportHistoryDashboard";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Import History",
  description: "View automatic manufacturer import runs and their results.",
  path: "/admin/import-history",
});

export default function ImportHistoryPage() {
  return (
    <AppLayout>
      <PageContainer size="lg">
        <ImportHistoryDashboard />
      </PageContainer>
    </AppLayout>
  );
}
