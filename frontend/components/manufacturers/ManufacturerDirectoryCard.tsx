import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type {
  ManufacturerDirectoryEntry,
  ManufacturerImportStatus,
} from "@/types/manufacturer-directory";

const STATUS_STYLES: Record<ManufacturerImportStatus, string> = {
  succeeded: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
  catalogue: "border-white/10 bg-white/[0.04] text-white/55",
  partial: "border-amber-400/25 bg-amber-400/10 text-amber-200",
  failed: "border-red-400/25 bg-red-400/10 text-red-200",
  running: "border-sky-400/25 bg-sky-400/10 text-sky-200",
};

const STATUS_LABELS: Record<ManufacturerImportStatus, string> = {
  succeeded: "Imported",
  catalogue: "In catalogue",
  partial: "Partial import",
  failed: "Import failed",
  running: "Importing",
};

function formatImportDate(value?: string): string {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function ManufacturerLogo({
  name,
  logoUrl,
}: {
  name: string;
  logoUrl?: string;
}) {
  if (logoUrl && logoUrl.startsWith("/")) {
    return (
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/5">
        <Image src={logoUrl} alt={`${name} logo`} fill className="object-contain p-2" />
      </div>
    );
  }

  if (logoUrl) {
    return (
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt={`${name} logo`}
          className="h-full w-full object-contain p-2"
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] font-mono text-sm font-bold text-white/45">
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

interface ManufacturerDirectoryCardProps {
  manufacturer: ManufacturerDirectoryEntry;
}

/** Card for a single manufacturer in the directory. */
export function ManufacturerDirectoryCard({ manufacturer }: ManufacturerDirectoryCardProps) {
  return (
    <Link
      href={manufacturer.profileHref}
      className="group block rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 transition-all hover:border-white/[0.16] hover:bg-white/[0.04]"
    >
      <div className="flex items-start gap-4">
        <ManufacturerLogo name={manufacturer.name} logoUrl={manufacturer.logoUrl} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="text-base font-semibold text-white group-hover:text-sky-100">
              {manufacturer.name}
            </h3>
            <span
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide",
                STATUS_STYLES[manufacturer.importStatus],
              )}
            >
              {STATUS_LABELS[manufacturer.importStatus]}
            </span>
          </div>

          {manufacturer.country && (
            <p className="mt-1 text-sm text-white/45">{manufacturer.country}</p>
          )}

          <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wider text-white/30">Products</p>
              <p className="mt-0.5 font-mono text-white/80">{manufacturer.productCount}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-white/30">Last import</p>
              <p className="mt-0.5 font-mono text-white/80">
                {formatImportDate(manufacturer.lastImportDate)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
