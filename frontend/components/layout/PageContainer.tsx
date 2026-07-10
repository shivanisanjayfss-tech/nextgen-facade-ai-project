import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  size?: "md" | "lg" | "xl";
}

const sizeMap = {
  md: "max-w-4xl",
  lg: "max-w-6xl",
  xl: "max-w-7xl",
};

/** Constrains page content width with consistent padding. */
export function PageContainer({ children, className, size = "lg" }: PageContainerProps) {
  return (
    <div className={cn("mx-auto w-full px-4 py-8 sm:px-6 sm:py-12", sizeMap[size], className)}>
      {children}
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

/** Page title section with optional description and action slot. */
export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">{title}</h1>
        {description && (
          <p className="mt-2 max-w-2xl text-base text-white/50">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
