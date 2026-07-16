"use client";

import { useEffect, useMemo, useState } from "react";
import { ManufacturerCard } from "@/components/search/ManufacturerCard";
import {
  groupMaterialsByCategoryAndManufacturer,
  groupMaterialsWithRegistry,
  manufacturerKey,
  resolveSearchBrowseIntent,
} from "@/lib/material-browser";
import type { ApiResponse, MaterialSummary } from "@/types";
import type { ManufacturerRegistryRow } from "@/types/manufacturer-registry";

interface MaterialsBrowserProps {
  items: MaterialSummary[];
  total: number;
  query: string;
  activeCategory?: string;
}

interface ManufacturersResponse {
  manufacturers: ManufacturerRegistryRow[];
}

/** Category → manufacturer → products hierarchy for facade consultancy browsing. */
export function MaterialsBrowser({
  items,
  total,
  query,
  activeCategory,
}: MaterialsBrowserProps) {
  const [registry, setRegistry] = useState<ManufacturerRegistryRow[]>([]);
  const [registryLoaded, setRegistryLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadRegistry() {
      try {
        const response = await fetch("/api/manufacturers");
        const json = (await response.json()) as ApiResponse<ManufacturersResponse>;
        if (!cancelled && response.ok && json.success) {
          setRegistry(json.data.manufacturers ?? []);
        }
      } catch {
        if (!cancelled) setRegistry([]);
      } finally {
        if (!cancelled) setRegistryLoaded(true);
      }
    }

    void loadRegistry();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredRegistry = useMemo(() => {
    if (!activeCategory) return registry;
    return registry.filter(
      (row) => row.category.toLowerCase() === activeCategory.toLowerCase(),
    );
  }, [registry, activeCategory]);

  const groups = useMemo(() => {
    if (registryLoaded && filteredRegistry.length > 0) {
      return groupMaterialsWithRegistry(items, filteredRegistry, {
        hideZeroProductManufacturers: true,
      });
    }

    return groupMaterialsByCategoryAndManufacturer(items);
  }, [items, filteredRegistry, registryLoaded]);

  const intent = useMemo(
    () => resolveSearchBrowseIntent(query, groups, activeCategory),
    [query, groups, activeCategory],
  );

  const autoExpandKey = Array.from(intent.expandManufacturers).sort().join("|");
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    setExpandedKeys(new Set(intent.expandManufacturers));
  }, [autoExpandKey, query, activeCategory, intent.expandManufacturers]);

  function toggleManufacturer(
    category: string,
    manufacturer: string,
    manufacturerId?: string | null,
  ) {
    const key = manufacturerKey(category, manufacturer, manufacturerId);
    setExpandedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const manufacturerCount = groups.reduce(
    (sum, group) => sum + group.manufacturers.length,
    0,
  );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-white/40">
            {total} product{total !== 1 ? "s" : ""} · {manufacturerCount} manufacturer
            {manufacturerCount !== 1 ? "s" : ""}
            {query && (
              <>
                {" "}
                for &ldquo;<span className="text-white/60">{query}</span>&rdquo;
              </>
            )}
          </p>
          {activeCategory && (
            <p className="mt-1 text-xs text-blue-300/80">Filtered by {activeCategory}</p>
          )}
        </div>
      </div>

      <div className="space-y-10">
        {groups.map((group) => (
          <section key={group.category} aria-labelledby={`category-${group.category}`}>
            <div className="mb-4 flex items-center gap-3">
              <h2
                id={`category-${group.category}`}
                className="text-lg font-semibold tracking-tight text-white"
              >
                {group.category}
              </h2>
              <div className="h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" />
              <span className="text-xs font-medium uppercase tracking-wider text-white/30">
                {group.totalProducts} products
              </span>
            </div>

            <div className="space-y-3">
              {group.manufacturers.map((manufacturerGroup) => {
                const key = manufacturerKey(
                  group.category,
                  manufacturerGroup.manufacturer,
                  manufacturerGroup.manufacturerId,
                );

                return (
                  <ManufacturerCard
                    key={key}
                    manufacturer={manufacturerGroup.manufacturer}
                    displayName={manufacturerGroup.displayName}
                    brands={manufacturerGroup.brands}
                    products={manufacturerGroup.products}
                    count={manufacturerGroup.count}
                    expanded={expandedKeys.has(key)}
                    onToggle={() =>
                      toggleManufacturer(
                        group.category,
                        manufacturerGroup.manufacturer,
                        manufacturerGroup.manufacturerId,
                      )
                    }
                    highlightedSlug={intent.highlightedSlug}
                  />
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
