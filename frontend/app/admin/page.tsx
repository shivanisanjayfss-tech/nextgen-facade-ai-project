import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Admin Dashboard",
  description: "Platform overview for imports, manufacturers, and analytics.",
  path: "/admin",
});

export default function AdminPage() {
  return (
    <AppLayout>
      <PageContainer size="xl">
        <AdminDashboard />
      </PageContainer>
    </AppLayout>
  );
}
