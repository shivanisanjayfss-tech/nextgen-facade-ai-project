import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  label?: string;
}

const sizeMap = { sm: "h-4 w-4", md: "h-8 w-8", lg: "h-12 w-12" };

/** Centered loading spinner for async operations. */
export function LoadingSpinner({ size = "md", className, label = "Loading..." }: LoadingSpinnerProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3", className)}>
      <div
        className={cn(
          "animate-spin rounded-full border-2 border-white/10 border-t-white/60",
          sizeMap[size],
        )}
        role="status"
        aria-label={label}
      />
      {size !== "sm" && (
        <p className="text-sm text-white/40">{label}</p>
      )}
    </div>
  );
}
