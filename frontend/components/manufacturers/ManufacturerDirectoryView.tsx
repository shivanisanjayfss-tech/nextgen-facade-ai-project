import { ManufacturerDirectoryCard } from "@/components/manufacturers/ManufacturerDirectoryCard";
import { EmptyState } from "@/components/ui/EmptyState";
import type { ManufacturerDirectoryResult } from "@/types/manufacturer-directory";

interface ManufacturerDirectoryViewProps {
  directory: ManufacturerDirectoryResult;
}

/** Manufacturer directory grouped by material category. */
export function ManufacturerDirectoryView({ directory }: ManufacturerDirectoryViewProps) {
  if (directory.groups.length === 0) {
    return (
      <EmptyState
        title="No manufacturers yet"
        description="Import materials to populate the manufacturer directory automatically."
        icon={
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-9.75 0V21"
            />
          </svg>
        }
      />
    );
  }

  return (
    <div className="space-y-12">
      <div className="flex flex-wrap gap-6 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-6 py-5">
        <div>
          <p className="text-xs uppercase tracking-wider text-white/35">Manufacturers</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
            {directory.totalManufacturers}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-white/35">Imported products</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
            {directory.totalProducts}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-white/35">Categories</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
            {directory.groups.length}
          </p>
        </div>
      </div>

      {directory.groups.map((group) => (
        <section key={group.category} aria-labelledby={`category-${group.category}`}>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2
                id={`category-${group.category}`}
                className="text-xl font-semibold tracking-tight text-white"
              >
                {group.category}
              </h2>
              <p className="mt-1 text-sm text-white/40">
                {group.manufacturers.length} manufacturer
                {group.manufacturers.length !== 1 ? "s" : ""} · {group.totalProducts} products
              </p>
            </div>
            <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent sm:max-w-xs" />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {group.manufacturers.map((manufacturer) => (
              <ManufacturerDirectoryCard
                key={`${group.category}-${manufacturer.name}`}
                manufacturer={manufacturer}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
