import Image from "next/image";
import Link from "next/link";
import { ProductMediaGallery } from "@/components/materials/ProductMediaGallery";
import { TechnicalSpecificationsCard } from "@/components/materials/TechnicalSpecificationsCard";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import {
  buildManufacturerBackHref,
  getDatasheetUrl,
  getManufacturerProfile,
  getManufacturerWebsiteUrl,
  getMaterialColours,
  getProductDetailDownloads,
  getProductDetailImages,
  getTechnicalSpecifications,
  getProductBreadcrumbs,
  getSwatchBackground,
  resolveMaterialImageUrl,
} from "@/lib/material-detail";
import type { Material, MaterialSummary } from "@/types";

interface MaterialDetailViewProps {
  material: Material;
  relatedProducts: MaterialSummary[];
  manufacturerProductCount: number;
}

function ExternalImage({
  src,
  alt,
  className = "object-cover",
  priority = false,
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  if (src.startsWith("/")) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        className={className}
        sizes="(max-width: 1280px) 100vw, 60vw"
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={`absolute inset-0 h-full w-full ${className}`}
      loading={priority ? "eager" : "lazy"}
    />
  );
}

function SectionHeader({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-5 flex items-start gap-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] font-mono text-xs font-semibold text-white/50">
        {number}
      </div>
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-white sm:text-xl">{title}</h2>
        {description && <p className="mt-1 text-sm text-white/40">{description}</p>}
      </div>
    </div>
  );
}

function ProductBreadcrumb({ items }: { items: ReturnType<typeof getProductBreadcrumbs> }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-8">
      <ol className="flex flex-wrap items-center gap-2 text-sm text-white/40">
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex items-center gap-2">
            {index > 0 && (
              <svg
                className="h-3.5 w-3.5 text-white/20"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            )}
            {item.href ? (
              <Link
                href={item.href}
                className="transition-colors hover:text-white/80"
              >
                {item.label}
              </Link>
            ) : (
              <span className="font-medium text-white/75">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function ActionButton({
  href,
  children,
  variant = "secondary",
  external = false,
  size = "default",
  disabled = false,
  className = "",
}: {
  href?: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "outline";
  external?: boolean;
  size?: "default" | "large";
  disabled?: boolean;
  className?: string;
}) {
  const styles = {
    primary:
      "border-white bg-white text-[#0B1120] hover:bg-white/90",
    secondary:
      "border-white/10 bg-white/[0.06] text-white hover:border-white/20 hover:bg-white/10",
    outline:
      "border-white/15 bg-transparent text-white/80 hover:border-white/25 hover:bg-white/[0.04]",
  };

  const sizeStyles = {
    default: "px-5 py-3 text-sm",
    large: "w-full px-6 py-4 text-base sm:w-auto",
  };

  const baseClassName = `inline-flex items-center justify-center gap-2 rounded-xl border font-medium transition-all ${sizeStyles[size]} ${className}`;

  if (disabled || !href) {
    return (
      <button
        type="button"
        disabled
        className={`${baseClassName} cursor-not-allowed border-white/10 bg-white/[0.04] text-white/35`}
      >
        {children}
      </button>
    );
  }

  return (
    <Link
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      download={external && href.toLowerCase().includes(".pdf") ? true : undefined}
      className={`${baseClassName} ${styles[variant]}`}
    >
      {children}
    </Link>
  );
}

function HeroActions({
  datasheetUrl,
  websiteUrl,
}: {
  datasheetUrl?: string;
  websiteUrl?: string;
}) {
  return (
    <div className="mt-8 space-y-3">
      <div className="space-y-2">
        {datasheetUrl ? (
          <ActionButton href={datasheetUrl} variant="primary" size="large" external>
            <DownloadIcon className="h-5 w-5" />
            Download Datasheet
          </ActionButton>
        ) : (
          <>
            <ActionButton variant="primary" size="large" disabled>
              <DownloadIcon className="h-5 w-5" />
              Download Datasheet
            </ActionButton>
            <p className="text-sm text-white/40">
              Datasheet will be available after the next import.
            </p>
          </>
        )}
      </div>

      {websiteUrl && (
        <ActionButton href={websiteUrl} variant="secondary" size="large" external>
          <ExternalLinkIcon />
          Visit Manufacturer Website
        </ActionButton>
      )}
    </div>
  );
}

/** Professional BIM-style product detail page for facade consultants. */
export function MaterialDetailView({
  material,
  relatedProducts,
  manufacturerProductCount,
}: MaterialDetailViewProps) {
  const breadcrumbs = getProductBreadcrumbs(material);
  const technicalSpecifications = getTechnicalSpecifications(material);
  const colours = getMaterialColours(material);
  const downloads = getProductDetailDownloads(material);
  const productImages = getProductDetailImages(material);
  const imageUrl = resolveMaterialImageUrl(material);
  const galleryImages = imageUrl
    ? productImages.filter((url) => url !== imageUrl)
    : productImages;
  const manufacturer = getManufacturerProfile(material, manufacturerProductCount);
  const datasheetUrl = getDatasheetUrl(material);
  const websiteUrl = getManufacturerWebsiteUrl(material);
  const description = material.description.trim();

  return (
    <div className="space-y-12 lg:space-y-16">
      <ProductBreadcrumb items={breadcrumbs} />

      {/* Section 1 — Overview */}
      <section aria-labelledby="product-hero">
        <div className="overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] via-white/[0.02] to-transparent">
          <div className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            <div className="border-b border-white/[0.06] lg:border-b-0 lg:border-r">
              <ProductMediaGallery
                images={galleryImages}
                imageUrl={imageUrl}
                productName={material.name}
                category={material.category}
              />
            </div>

            <div className="flex flex-col justify-center p-6 sm:p-8 lg:p-10">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="category">{material.category}</Badge>
                <span className="text-xs font-medium uppercase tracking-wider text-white/30">
                  Product Specification
                </span>
              </div>

              <h1
                id="product-hero"
                className="mt-5 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]"
              >
                {material.name}
              </h1>

              <p className="mt-3 text-lg font-medium text-sky-200/90">{material.manufacturer}</p>

              {description && (
                <p className="mt-5 max-w-xl text-base leading-relaxed text-white/55">
                  {description}
                </p>
              )}

              <HeroActions datasheetUrl={datasheetUrl} websiteUrl={websiteUrl} />
            </div>
          </div>
        </div>
      </section>

      <TechnicalSpecificationsCard specifications={technicalSpecifications} />

      <section
        aria-labelledby="compare-action"
        className="flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
      >
        <div>
          <h2 id="compare-action" className="text-base font-semibold text-white">
            Compare this product
          </h2>
          <p className="mt-1 text-sm text-white/40">
            Evaluate this product alongside alternatives for your facade package.
          </p>
        </div>
        <ActionButton
          href={`/compare?ids=${material.id}`}
          variant="secondary"
          className="shrink-0"
        >
          <CompareIcon />
          Compare
        </ActionButton>
      </section>

      {/* Section 3 — Available Colours */}
      {colours.length > 0 && (
        <section aria-labelledby="available-colours">
          <SectionHeader
            number="03"
            title="Available Colours"
            description="Finish options for facade coordination and client presentations."
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {colours.map((swatch) => (
              <div
                key={swatch.name}
                className="flex items-center gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-3"
              >
                <div
                  className="h-12 w-12 shrink-0 rounded-xl border border-white/10 shadow-inner"
                  style={{ background: getSwatchBackground(swatch) }}
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{swatch.name}</p>
                  {swatch.hex && (
                    <p className="font-mono text-xs text-white/35">{swatch.hex.toUpperCase()}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Downloads */}
      {downloads.length > 0 && (
        <section aria-labelledby="downloads">
          <SectionHeader
            number="04"
            title="Downloads"
            description="Manufacturer documentation for tender packages and site teams."
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {downloads.map((download) => (
              <a
                key={`${download.label}-${download.url}`}
                href={download.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-5 py-4 transition-all hover:border-sky-400/25 hover:bg-sky-400/5"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/50 transition-colors group-hover:border-sky-400/30 group-hover:text-sky-200">
                  <DownloadIcon />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-white">{download.label}</p>
                  <p className="text-xs text-white/40">PDF / Document</p>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <section aria-labelledby="related-products">
          <SectionHeader
            number={downloads.length > 0 ? "05" : "04"}
            title="Related Products"
            description={`More products from ${material.manufacturer}.`}
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {relatedProducts.map((product) => (
              <Link
                key={product.id}
                href={`/materials/${product.slug}`}
                className="group rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 transition-all hover:border-white/[0.16] hover:bg-white/[0.04]"
              >
                <div className="flex items-start gap-4">
                  {product.imageUrl ? (
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[#0d1424]">
                      <ExternalImage
                        src={product.imageUrl}
                        alt={product.name}
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 font-mono text-xs font-bold text-white/30">
                      {product.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-medium text-white group-hover:text-sky-100">
                      {product.name}
                    </p>
                    <p className="mt-1 text-xs text-white/40">{product.category}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Manufacturer */}
      <section aria-labelledby="manufacturer-profile">
        <SectionHeader
          number="06"
          title="Manufacturer"
          description="Supplier information for procurement and submittal workflows."
        />
        <Card className="p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 font-mono text-sm font-bold text-white/40">
                {manufacturer.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h3 id="manufacturer-profile" className="text-xl font-semibold text-white">
                  {manufacturer.name}
                </h3>
                {manufacturer.country && (
                  <p className="mt-1 text-sm text-white/45">{manufacturer.country}</p>
                )}
                {typeof manufacturer.productCount === "number" && (
                  <p className="mt-2 text-sm text-white/50">
                    <span className="font-mono text-white/80">{manufacturer.productCount}</span>
                    {" "}products in catalogue
                  </p>
                )}
                {manufacturer.description && (
                  <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/55">
                    {manufacturer.description}
                  </p>
                )}
              </div>
            </div>
            {manufacturer.website && (
              <a
                href={manufacturer.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white/70 transition-colors hover:border-white/20 hover:text-white"
              >
                <ExternalLinkIcon />
                Official Website
              </a>
            )}
          </div>
          <div className="mt-6 border-t border-white/[0.06] pt-5">
            <Link
              href={buildManufacturerBackHref(material)}
              className="text-sm font-medium text-sky-300/80 transition-colors hover:text-sky-200"
            >
              View all {manufacturer.name} products →
            </Link>
          </div>
        </Card>
      </section>
    </div>
  );
}

function DownloadIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
      />
    </svg>
  );
}

function CompareIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
      />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
      />
    </svg>
  );
}
