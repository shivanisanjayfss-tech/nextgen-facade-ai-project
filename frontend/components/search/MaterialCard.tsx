import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { truncate } from "@/lib/utils";
import type { MaterialSummary } from "@/types";

interface MaterialCardProps {
  material: MaterialSummary;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
}

/** Card displaying a material summary in search and compare views. */
export function MaterialCard({
  material,
  selectable = false,
  selected = false,
  onSelect,
}: MaterialCardProps) {
  const content = (
    <Card
      hover
      className={`p-5 ${selected ? "border-blue-400/30 bg-blue-400/5" : ""}`}
    >
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-lg font-bold text-white/30">
          {material.category.slice(0, 2)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-white">{material.name}</h3>
            <Badge variant="category">{material.category}</Badge>
          </div>
          <p className="mt-1 text-xs text-white/40">{material.manufacturer}</p>
          <p className="mt-2 text-sm text-white/45">
            {truncate(material.description, 120)}
          </p>
          {material.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {material.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="tag">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
        {selectable && (
          <div
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
              selected
                ? "border-blue-400 bg-blue-400 text-white"
                : "border-white/20 bg-transparent"
            }`}
          >
            {selected && (
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            )}
          </div>
        )}
      </div>
    </Card>
  );

  if (selectable && onSelect) {
    return (
      <button type="button" onClick={() => onSelect(material.id)} className="w-full text-left">
        {content}
      </button>
    );
  }

  return <Link href={`/materials/${material.slug}`}>{content}</Link>;
}
