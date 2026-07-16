import Image from "next/image";
import Link from "next/link";
import { MaterialCard } from "@/components/search/MaterialCard";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { ManufacturerProfile } from "@/types/manufacturer-profile";

function ManufacturerLogo({ name, logoUrl }: { name: string; logoUrl?: string }) {
  if (logoUrl?.startsWith("/")) {
    return (
      <div className="relative h-20 w-20 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        <Image src={logoUrl} alt={`${name} logo`} fill className="object-contain p-3" />
      </div>
    );
  }

  if (logoUrl) {
    return (
      <div className="relative h-20 w-20 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt={`${name} logo`} className="h-full w-full object-contain p-3" />
      </div>
    );
  }

  return (
    <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] text-xl font-bold text-white/45">
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

function formatDate(value?: string): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

interface ManufacturerProfileViewProps {
  profile: ManufacturerProfile;
}

/** Dynamic manufacturer detail page — no hardcoded manufacturer logic. */
export function ManufacturerProfileView({ profile }: ManufacturerProfileViewProps) {
  const productsHref = `/search?q=${encodeURIComponent(profile.name)}`;

  return (
    <div className="space-y-8">
      <Card className="p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <ManufacturerLogo name={profile.name} logoUrl={profile.logoUrl} />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-white">{profile.name}</h1>
              {profile.brand && <Badge variant="category">{profile.brand}</Badge>}
            </div>

            {profile.country && (
              <p className="mt-2 text-sm text-white/50">{profile.country}</p>
            )}

            {profile.description && (
              <p className="mt-4 max-w-3xl text-base leading-relaxed text-white/60">
                {profile.description}
              </p>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              {profile.websiteUrl && (
                <a
                  href={profile.websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex rounded-lg border border-white/10 px-4 py-2 text-sm text-sky-300 hover:border-white/20 hover:bg-white/5"
                >
                  Visit website
                </a>
              )}
              <Link
                href={productsHref}
                className="inline-flex rounded-lg border border-white/10 px-4 py-2 text-sm text-white/80 hover:border-white/20 hover:bg-white/5"
              >
                View all products
              </Link>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Products" value={String(profile.productCount)} />
        <StatCard label="Categories" value={String(profile.categories.length)} />
        <StatCard label="Import status" value={profile.importStatus} />
        <StatCard label="Last import" value={formatDate(profile.lastImportDate)} />
      </div>

      {profile.categories.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-white">Categories</h2>
          <div className="flex flex-wrap gap-2">
            {profile.categories.map((category) => (
              <Link
                key={category}
                href={`/search?category=${encodeURIComponent(category)}&q=${encodeURIComponent(profile.name)}`}
              >
                <Badge variant="category">{category}</Badge>
              </Link>
            ))}
          </div>
        </section>
      )}

      {profile.lastImportStats && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-white">Latest import</h2>
          <div className="grid gap-3 sm:grid-cols-4">
            <StatCard label="Imported" value={String(profile.lastImportStats.imported)} />
            <StatCard label="Updated" value={String(profile.lastImportStats.updated)} />
            <StatCard label="Skipped" value={String(profile.lastImportStats.skipped)} />
            <StatCard label="Failed" value={String(profile.lastImportStats.failed)} />
          </div>
        </section>
      )}

      {profile.products.length > 0 && (
        <section>
          <div className="mb-4 flex items-end justify-between gap-4">
            <h2 className="text-lg font-semibold text-white">Products</h2>
            {profile.productCount > profile.products.length && (
              <Link href={productsHref} className="text-sm text-sky-300 hover:underline">
                View all {profile.productCount} products
              </Link>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {profile.products.map((product) => (
              <MaterialCard key={product.id} material={product} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wide text-white/40">{label}</p>
      <p className="mt-1 text-lg font-semibold capitalize text-white">{value}</p>
    </Card>
  );
}
