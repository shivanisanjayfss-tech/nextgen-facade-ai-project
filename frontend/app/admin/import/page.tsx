import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { AdminImportForm } from "@/components/admin/AdminImportForm";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Admin Import",
  description: "Import facade materials from manufacturer websites into Supabase.",
  path: "/admin/import",
});

export default function AdminImportPage() {
  return (
    <AppLayout>
      <PageContainer size="md">
        <AdminImportForm />
      </PageContainer>
    </AppLayout>
  );
}
