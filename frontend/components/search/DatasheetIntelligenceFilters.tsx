"use client";

export interface DatasheetSearchFiltersState {
  fireRating?: string;
  thickness?: string;
  finish?: string;
  thermalValue?: string;
  certification?: string;
}

interface DatasheetIntelligenceFiltersProps {
  filters: DatasheetSearchFiltersState;
  onChange: (filters: DatasheetSearchFiltersState) => void;
}

const FILTER_FIELDS: Array<{
  key: keyof DatasheetSearchFiltersState;
  label: string;
  placeholder: string;
}> = [
  { key: "fireRating", label: "Fire Rating", placeholder: "e.g. A2-s1,d0" },
  { key: "thickness", label: "Thickness", placeholder: "e.g. 4mm" },
  { key: "finish", label: "Finish", placeholder: "e.g. PVDF" },
  { key: "thermalValue", label: "Thermal Value", placeholder: "e.g. 0.35 W/mK" },
  { key: "certification", label: "Certification", placeholder: "e.g. EN 13501" },
];

/** Technical datasheet facet filters for intelligent material search. */
export function DatasheetIntelligenceFilters({
  filters,
  onChange,
}: DatasheetIntelligenceFiltersProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-white/45">
        Datasheet Intelligence Filters
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {FILTER_FIELDS.map((field) => (
          <label key={field.key} className="block">
            <span className="mb-1 block text-xs text-white/50">{field.label}</span>
            <input
              type="text"
              value={filters[field.key] ?? ""}
              placeholder={field.placeholder}
              onChange={(event) =>
                onChange({
                  ...filters,
                  [field.key]: event.target.value || undefined,
                })
              }
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none placeholder:text-white/25 focus:border-sky-400/40"
            />
          </label>
        ))}
      </div>
    </div>
  );
}
