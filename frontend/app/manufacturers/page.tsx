import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer, PageHeader } from "@/components/layout/PageContainer";
import { ManufacturerDirectoryView } from "@/components/manufacturers/ManufacturerDirectoryView";
import { createPageMetadata } from "@/lib/seo";
import { getManufacturerDirectory } from "@/services/manufacturer-directory.service";

export const metadata = createPageMetadata({
  title: "Manufacturers",
  description:
    "Browse facade material manufacturers by category — dynamically generated from imported product catalogues.",
  path: "/manufacturers",
});

export default async function ManufacturersPage() {
  const directory = await getManufacturerDirectory();

  return (
    <AppLayout>
      <PageContainer size="xl">
        <PageHeader
          title="Manufacturer Directory"
          description="Suppliers organised by material category. Every manufacturer is created automatically from imported products."
        />
        <ManufacturerDirectoryView directory={directory} />
      </PageContainer>
    </AppLayout>
  );
}
