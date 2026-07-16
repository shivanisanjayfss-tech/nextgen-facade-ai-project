import Link from "next/link";
import { notFound } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { ManufacturerProfileView } from "@/components/manufacturers/ManufacturerProfileView";
import { createPageMetadata } from "@/lib/seo";
import { getManufacturerProfile } from "@/services/manufacturer-profile.service";

interface ManufacturerDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ManufacturerDetailPageProps) {
  const { slug } = await params;
  const profile = await getManufacturerProfile(slug);

  return createPageMetadata({
    title: profile?.name ?? "Manufacturer",
    description:
      profile?.description ??
      `Browse ${profile?.name ?? "manufacturer"} facade products, specifications, and import status.`,
    path: `/manufacturers/${slug}`,
  });
}

export default async function ManufacturerDetailPage({ params }: ManufacturerDetailPageProps) {
  const { slug } = await params;
  const profile = await getManufacturerProfile(slug);

  if (!profile) {
    notFound();
  }

  return (
    <AppLayout>
      <PageContainer size="xl">
        <div className="mb-6">
          <Link
            href="/manufacturers"
            className="text-sm text-sky-300 transition-colors hover:text-sky-200 hover:underline"
          >
            ← Back to Manufacturers
          </Link>
        </div>
        <ManufacturerProfileView profile={profile} />
      </PageContainer>
    </AppLayout>
  );
}
