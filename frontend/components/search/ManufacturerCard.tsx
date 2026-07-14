"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { MaterialSummary } from "@/types";

interface ManufacturerCardProps {
  manufacturer: string;
  products: MaterialSummary[];
  count: number;
  expanded: boolean;
  onToggle: () => void;
  highlightedSlug?: string;
}

/** Expandable manufacturer card showing product list for facade consultancy browsing. */
export function ManufacturerCard({
  manufacturer,
  products,
  count,
  expanded,
  onToggle,
  highlightedSlug,
}: ManufacturerCardProps) {
  const highlightRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (expanded && highlightedSlug && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [expanded, highlightedSlug]);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border bg-white/[0.02] transition-all duration-300",
        expanded
          ? "border-blue-400/25 shadow-[0_8px_32px_rgba(59,130,246,0.08)]"
          : "border-white/[0.08] hover:border-white/[0.14] hover:bg-white/[0.04]",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-white/[0.03]"
      >
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-sm font-bold transition-colors",
            expanded
              ? "border-blue-400/30 bg-blue-400/10 text-blue-200"
              : "border-white/10 bg-white/5 text-white/40",
          )}
        >
          {manufacturer.slice(0, 2).toUpperCase()}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h3 className="text-base font-semibold text-white">{manufacturer}</h3>
            <span className="text-sm font-medium text-white/45">({count})</span>
          </div>
          <p className="mt-0.5 text-xs text-white/35">
            {count} product{count !== 1 ? "s" : ""}
          </p>
        </div>

        <svg
          className={cn(
            "h-5 w-5 shrink-0 text-white/40 transition-transform duration-300",
            expanded && "rotate-180 text-blue-300",
          )}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {expanded && (
        <ul className="border-t border-white/[0.06] px-3 py-2">
          {products.map((product) => {
            const isHighlighted = product.slug === highlightedSlug;

            return (
              <li key={product.id}>
                <Link
                  ref={isHighlighted ? highlightRef : undefined}
                  href={`/materials/${product.slug}`}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                    isHighlighted
                      ? "bg-blue-400/15 font-medium text-blue-100 ring-1 ring-blue-400/30"
                      : "text-white/70 hover:bg-white/[0.05] hover:text-white",
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      isHighlighted ? "bg-blue-300" : "bg-white/25",
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate">{product.name}</span>
                  {product.imageUrl && (
                    <span className="text-[10px] uppercase tracking-wide text-white/25">
                      View
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
