"use client";

import { cn } from "@/lib/utils";
import { MATERIAL_CATEGORIES } from "@/lib/material-categories";

interface SearchFiltersProps {
  activeCategory?: string;
  onCategoryChange: (category: string | undefined) => void;
}

/** Category filter pills for the search page. */
export function SearchFilters({ activeCategory, onCategoryChange }: SearchFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onCategoryChange(undefined)}
        className={cn(
          "rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
          !activeCategory
            ? "border-white/20 bg-white/10 text-white"
            : "border-white/10 bg-transparent text-white/50 hover:text-white/70",
        )}
      >
        All
      </button>
      {MATERIAL_CATEGORIES.filter((cat) => cat !== "Other").map((cat) => (
        <button
          key={cat}
          type="button"
          onClick={() => onCategoryChange(cat)}
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
            activeCategory === cat
              ? "border-blue-400/30 bg-blue-400/10 text-blue-300"
              : "border-white/10 bg-transparent text-white/50 hover:text-white/70",
          )}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}
