import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { ManufacturerRegistryAdmin } from "@/components/admin/ManufacturerRegistryAdmin";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Admin Manufacturers",
  description: "Manage the manufacturer registry — imports, search, and product linking.",
  path: "/admin/manufacturers",
});

export default function AdminManufacturersPage() {
  return (
    <AppLayout>
      <PageContainer size="xl">
        <ManufacturerRegistryAdmin />
      </PageContainer>
    </AppLayout>
  );
}
