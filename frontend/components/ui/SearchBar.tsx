"use client";

import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import type { FormEvent, InputHTMLAttributes } from "react";

interface SearchBarProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  size?: "md" | "lg";
  showShortcut?: boolean;
  onSearch?: (query: string) => void;
  navigateOnSubmit?: boolean;
  /** Controlled value — when set, input is controlled externally. */
  value?: string;
  onValueChange?: (value: string) => void;
}

/** Large search bar with icon and optional keyboard shortcut hint. */
export function SearchBar({
  size = "lg",
  showShortcut = true,
  onSearch,
  navigateOnSubmit = false,
  className,
  defaultValue,
  value,
  onValueChange,
  onChange,
  ...props
}: SearchBarProps) {
  const router = useRouter();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const query = (formData.get("q") as string)?.trim() ?? "";

    if (onSearch) {
      onSearch(query);
      return;
    }

    if (navigateOnSubmit) {
      router.push(`/search${query ? `?q=${encodeURIComponent(query)}` : ""}`);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={cn("relative w-full", className)}>
      <div className="pointer-events-none absolute inset-y-0 left-5 flex items-center">
        <svg
          className="h-5 w-5 text-white/30"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
          />
        </svg>
      </div>
      <input
        name="q"
        type="search"
        defaultValue={value === undefined ? defaultValue : undefined}
        value={value}
        onChange={(e) => {
          onValueChange?.(e.target.value);
          onChange?.(e);
        }}
        placeholder="Search ACP Sheet, Glass, Stone, HPL, Louvers..."
        className={cn(
          "w-full rounded-2xl border border-white/10 bg-white/[0.04] pl-14 pr-6 text-white placeholder-white/30 shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-xl transition-all focus:border-white/20 focus:bg-white/[0.07] focus:outline-none focus:ring-2 focus:ring-white/10",
          size === "lg" ? "py-5 text-base sm:text-lg" : "py-3 text-sm",
        )}
        {...props}
      />
      {showShortcut && size === "lg" && (
        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center sm:right-4">
          <kbd className="hidden rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/30 sm:inline-block">
            ⌘K
          </kbd>
        </div>
      )}
    </form>
  );
}
