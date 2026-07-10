import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

/** Displayed when a list or search returns no results. */
export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.02] px-6 py-16 text-center",
        className,
      )}
    >
      {icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/40">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-white/80">{title}</h3>
      {description && (
        <p className="mt-2 max-w-md text-sm text-white/40">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
