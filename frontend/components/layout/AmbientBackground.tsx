/** Ambient gradient glow effects for the dark premium background. */
export function AmbientBackground() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-blue-500/10 blur-[120px]" />
      <div className="absolute -left-32 top-1/3 h-[400px] w-[400px] rounded-full bg-indigo-500/8 blur-[100px]" />
      <div className="absolute -right-32 bottom-1/4 h-[350px] w-[350px] rounded-full bg-cyan-500/6 blur-[100px]" />
    </div>
  );
}
