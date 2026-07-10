"use client";

import { MaterialCard } from "@/components/search/MaterialCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { ComparisonResult, MaterialSummary } from "@/types";

interface CompareViewProps {
  materials: MaterialSummary[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onCompare: () => void;
  onClear: () => void;
  result: ComparisonResult | null;
  isLoading: boolean;
  error: string | null;
}

/** Material comparison page with selector and side-by-side table. */
export function CompareView({
  materials,
  selectedIds,
  onToggle,
  onCompare,
  onClear,
  result,
  isLoading,
  error,
}: CompareViewProps) {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-white/50">
          Select 2–4 materials to compare ({selectedIds.length} selected)
        </p>
        <div className="flex gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={onCompare}
            disabled={selectedIds.length < 2 || isLoading}
          >
            Compare Selected
          </Button>
          {selectedIds.length > 0 && (
            <Button variant="ghost" size="sm" onClick={onClear}>
              Clear
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {materials.map((material) => (
          <MaterialCard
            key={material.id}
            material={material}
            selectable
            selected={selectedIds.includes(material.id)}
            onSelect={onToggle}
          />
        ))}
      </div>

      {isLoading && <LoadingSpinner label="Generating comparison..." />}

      {error && <ErrorMessage message={error} />}

      {result && result.materials.length >= 2 && (
        <div className="space-y-6">
          {result.aiSummary && (
            <Card className="border-blue-400/20 bg-blue-400/5">
              <h3 className="mb-2 text-sm font-semibold text-blue-300">AI Analysis</h3>
              <p className="text-sm leading-relaxed text-white/70">{result.aiSummary}</p>
            </Card>
          )}

          <div className="overflow-x-auto rounded-2xl border border-white/[0.08]">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-white/[0.08] bg-white/[0.03]">
                  <th className="px-4 py-3 text-left font-medium text-white/50">Property</th>
                  {result.materials.map((m) => (
                    <th key={m.id} className="px-4 py-3 text-left font-medium text-white">
                      {m.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.criteria.map((criterion) => (
                  <tr key={criterion.key} className="border-b border-white/[0.04]">
                    <td className="px-4 py-3 font-medium text-white/50">{criterion.label}</td>
                    {result.materials.map((m) => {
                      let value: string;
                      if (criterion.key === "name") value = m.name;
                      else if (criterion.key === "manufacturer") value = m.manufacturer;
                      else if (criterion.key === "category") value = m.category;
                      else value = String(m.specs[criterion.key as keyof typeof m.specs] ?? "—");

                      return (
                        <td key={m.id} className="px-4 py-3 text-white/70">
                          {value}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
