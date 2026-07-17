interface FilterChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

/** Reusable pill filter control used across import history views. */
export function FilterChip({ label, active, onClick }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "border-sky-400/30 bg-sky-400/10 text-sky-200"
          : "border-white/10 bg-white/[0.03] text-white/50 hover:border-white/20 hover:text-white/70"
      }`}
    >
      {label}
    </button>
  );
}
