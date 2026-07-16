import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer, PageHeader } from "@/components/layout/PageContainer";
import { ManufacturerDirectoryView } from "@/components/manufacturers/ManufacturerDirectoryView";
import { createPageMetadata } from "@/lib/seo";
import { getManufacturerDirectory } from "@/services/manufacturer-directory.service";

export const metadata = createPageMetadata({
  title: "Manufacturers",
  description:
    "Browse facade material manufacturers by category — sourced from the manufacturer registry with live product counts.",
  path: "/manufacturers",
});

export default async function ManufacturersPage() {
  const directory = await getManufacturerDirectory({
    hideZeroProductManufacturers: true,
  });

  return (
    <AppLayout>
      <PageContainer size="xl">
        <PageHeader
          title="Manufacturer Directory"
          description="Suppliers from the manufacturer registry, organised by material category. Product counts come from linked catalogue materials."
        />
        <ManufacturerDirectoryView directory={directory} />
      </PageContainer>
    </AppLayout>
  );
}
