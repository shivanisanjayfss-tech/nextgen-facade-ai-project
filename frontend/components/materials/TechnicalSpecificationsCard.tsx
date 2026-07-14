import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import type {
  SpecSectionId,
  TechnicalSpecRow,
  TechnicalSpecSection,
  TechnicalSpecifications,
} from "@/lib/material-detail";

interface TechnicalSpecificationsCardProps {
  specifications: TechnicalSpecifications;
}

const SECTION_ICONS: Record<SpecSectionId, ReactNode> = {
  general: <GeneralIcon />,
  physical: <PhysicalIcon />,
  performance: <PerformanceIcon />,
  glass: <GlassIcon />,
  surface: <SurfaceIcon />,
  standards: <StandardsIcon />,
  commercial: <CommercialIcon />,
};

const EMPTY_STATE_MESSAGE =
  "Technical specifications will be available after the next automatic import.";

/** Grouped engineering specification layout for facade consultants. */
export function TechnicalSpecificationsCard({
  specifications,
}: TechnicalSpecificationsCardProps) {
  const { sections, hasDetailedSpecs, datasheetUrl } = specifications;
  const technicalSections = sections.filter((section) => section.id !== "general");
  const generalSection = sections.find((section) => section.id === "general");

  return (
    <section aria-labelledby="technical-specs" className="scroll-mt-8">
      <Card className="overflow-hidden p-0">
        <div className="border-b border-white/[0.06] bg-gradient-to-r from-white/[0.04] via-white/[0.02] to-transparent px-6 py-5 sm:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-400/20 bg-sky-400/10 text-sky-200">
                <BlueprintIcon />
              </div>
              <div>
                <h2
                  id="technical-specs"
                  className="text-lg font-semibold tracking-tight text-white sm:text-xl"
                >
                  Technical Specifications
                </h2>
                <p className="mt-1 text-sm text-white/40">
                  Structured product data for specification writing and submittal packages.
                </p>
              </div>
            </div>

            {datasheetUrl && (
              <a
                href={datasheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-2.5 text-xs font-medium text-emerald-100/90 transition-colors hover:border-emerald-300/30 hover:bg-emerald-400/15"
              >
                <DocumentIcon />
                Sourced from manufacturer datasheet
              </a>
            )}
          </div>
        </div>

        {generalSection && (
          <SpecSectionBlock section={generalSection} isFirst />
        )}

        {hasDetailedSpecs ? (
          technicalSections.map((section) => (
            <SpecSectionBlock key={section.id} section={section} />
          ))
        ) : (
          <div className="border-t border-white/[0.06] px-6 py-10 sm:px-8">
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-white/35">
                <PendingIcon />
              </div>
              <p className="max-w-md text-sm leading-relaxed text-white/45">{EMPTY_STATE_MESSAGE}</p>
            </div>
          </div>
        )}
      </Card>
    </section>
  );
}

function SpecSectionBlock({
  section,
  isFirst = false,
}: {
  section: TechnicalSpecSection;
  isFirst?: boolean;
}) {
  return (
    <div className={isFirst ? "" : "border-t border-white/[0.06]"}>
      <div className="flex items-center gap-3 border-b border-white/[0.06] bg-white/[0.02] px-6 py-3.5 sm:px-8">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-sky-200/70"
          aria-hidden
        >
          {SECTION_ICONS[section.id]}
        </span>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-white/55">
          {section.title}
        </h3>
      </div>

      <div className="hidden border-b border-white/[0.04] px-6 py-2.5 sm:grid sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] sm:gap-8 lg:px-8">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/30">
          Property
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/30">
          Value
        </span>
      </div>

      <dl className="divide-y divide-white/[0.05]">
        {section.entries.map((entry, index) => (
          <SpecRow key={`${section.id}-${entry.key}-${entry.label}`} entry={entry} index={index} />
        ))}
      </dl>
    </div>
  );
}

function SpecRow({ entry, index }: { entry: TechnicalSpecRow; index: number }) {
  return (
    <div
      className={`grid gap-1.5 px-6 py-3.5 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] sm:items-center sm:gap-8 lg:px-8 ${
        index % 2 === 0 ? "bg-transparent" : "bg-white/[0.012]"
      }`}
    >
      <dt className="text-sm font-medium text-white/50">{entry.label}</dt>
      <dd className="font-mono text-sm leading-relaxed text-white/90">
        {entry.href ? (
          <a
            href={entry.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sky-300/90 transition-colors hover:text-sky-200"
          >
            {entry.value}
            <ExternalLinkIcon />
          </a>
        ) : (
          entry.value
        )}
      </dd>
    </div>
  );
}

function BlueprintIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 4.5v15m6-15v15M4.5 9h15M4.5 15h15M4.5 4.5h15a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75h-15a.75.75 0 0 1-.75-.75V5.25a.75.75 0 0 1 .75-.75Z"
      />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
      />
    </svg>
  );
}

function PendingIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
      />
    </svg>
  );
}

function GeneralIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
      />
    </svg>
  );
}

function PhysicalIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0 9 9m9-9h-4.5m4.5 0v4.5m0-4.5-9 9m9-9v4.5m0 4.5h-4.5m4.5 0-9-9m-9 9h4.5m-4.5 0v-4.5"
      />
    </svg>
  );
}

function PerformanceIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
      />
    </svg>
  );
}

function GlassIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3v2.25m0 13.5V21m9-9h-2.25M5.25 12H3m15.364 6.364-1.591-1.591M6.227 6.227 4.636 4.636m12.728 0-1.591 1.591M6.227 17.773l-1.591 1.591M16.5 12a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z"
      />
    </svg>
  );
}

function SurfaceIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128Zm0 0a15.364 15.364 0 0 1-1.843 6.632M9.53 16.122A15.364 15.364 0 0 0 18 18"
      />
    </svg>
  );
}

function StandardsIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.375 3.375 0 0 1-1.853 3.318 3.375 3.375 0 0 1-3.68-.99 3.375 3.375 0 0 0-4.548 0 3.375 3.375 0 0 1-3.68.99 3.375 3.375 0 0 1-1.853-3.318C3.63 14.39 3 13.268 3 12s.63-2.39 1.593-3.068a3.375 3.375 0 0 1 1.853-3.318 3.375 3.375 0 0 1 3.68.99 3.375 3.375 0 0 0 4.548 0 3.375 3.375 0 0 1 3.68-.99 3.375 3.375 0 0 1 1.853 3.318C20.37 9.61 21 10.732 21 12Z"
      />
    </svg>
  );
}

function CommercialIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20.25 14.15v4.25c0 .414-.336.75-.75.75h-4.5a.75.75 0 0 1-.75-.75v-4.25m0 0h4.125c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9m9 9H9.375c-.621 0-1.125.504-1.125 1.125v3.375c0 .621.504 1.125 1.125 1.125H12m9 0h-2.25M12 20.25V9.75m0 0H8.25M12 9.75h3.75M12 9.75v10.5"
      />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
      />
    </svg>
  );
}
