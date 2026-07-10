import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { formatDate } from "@/lib/utils";
import type { Datasheet } from "@/types";

interface DatasheetCardProps {
  datasheet: Datasheet;
}

/** Datasheet preview card with download link. */
export function DatasheetCard({ datasheet }: DatasheetCardProps) {
  return (
    <Link href={`/datasheets/${datasheet.id}`}>
      <Card hover className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5">
          <svg className="h-5 w-5 text-white/50" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-white">{datasheet.title}</h3>
            <Badge variant="category">{datasheet.category}</Badge>
          </div>
          <p className="mt-1 text-xs text-white/40">{datasheet.manufacturer}</p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-white/30">
            {datasheet.version && <span>{datasheet.version}</span>}
            {datasheet.fileSize && <span>{datasheet.fileSize}</span>}
            {datasheet.pages && <span>{datasheet.pages} pages</span>}
            <span>{formatDate(datasheet.publishedAt)}</span>
          </div>
        </div>
      </Card>
    </Link>
  );
}

interface DatasheetListProps {
  datasheets: Datasheet[];
}

/** List of datasheet cards. */
export function DatasheetList({ datasheets }: DatasheetListProps) {
  return (
    <div className="space-y-3">
      {datasheets.map((ds) => (
        <DatasheetCard key={ds.id} datasheet={ds} />
      ))}
    </div>
  );
}
