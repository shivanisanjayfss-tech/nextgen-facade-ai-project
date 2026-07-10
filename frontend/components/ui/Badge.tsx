import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "category" | "tag";
}

const variantStyles = {
  default: "border-white/10 bg-white/5 text-white/70",
  category: "border-blue-400/20 bg-blue-400/10 text-blue-300",
  tag: "border-white/10 bg-white/[0.03] text-white/50",
};

/** Small label badge for categories, tags, and status indicators. */
export function Badge({ variant = "default", className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        variantStyles[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
