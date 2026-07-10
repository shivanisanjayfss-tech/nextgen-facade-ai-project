import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { Material } from "@/types";

interface MaterialDetailViewProps {
  material: Material;
}

/** Full material detail view with specs table and actions. */
export function MaterialDetailView({ material }: MaterialDetailViewProps) {
  const specEntries = Object.entries(material.specs).filter(
    ([, value]) => value !== undefined,
  );

  return (
    <div className="space-y-8">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="category">{material.category}</Badge>
          {material.tags.map((tag) => (
            <Badge key={tag} variant="tag">
              {tag}
            </Badge>
          ))}
        </div>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          {material.name}
        </h1>
        <p className="mt-2 text-lg text-white/50">{material.manufacturer}</p>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-white/60">
          {material.description}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={`/compare?ids=${material.id}`}>
            <Button variant="primary">Compare</Button>
          </Link>
          {material.datasheetUrl && (
            <Link href={`/datasheets?material=${material.id}`}>
              <Button variant="outline">View Datasheet</Button>
            </Link>
          )}
        </div>
      </div>

      <Card>
        <h2 className="mb-6 text-lg font-semibold text-white">Technical Specifications</h2>
        <div className="divide-y divide-white/[0.06]">
          {specEntries.map(([key, value]) => (
            <div key={key} className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm font-medium capitalize text-white/50">
                {key.replace(/([A-Z])/g, " $1").trim()}
              </span>
              <span className="text-sm text-white/80">
                {Array.isArray(value) ? value.join(", ") : String(value)}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
