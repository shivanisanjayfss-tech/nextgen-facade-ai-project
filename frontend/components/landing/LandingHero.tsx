import { SearchBar } from "@/components/ui/SearchBar";

/** Landing page hero section with title, subtitle, and search bar. */
export function LandingHero() {
  return (
    <div className="mx-auto max-w-4xl text-center">
      <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-white/70 backdrop-blur-md">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        AI-Powered Material Intelligence
      </div>

      <h1 className="bg-gradient-to-b from-white to-white/60 bg-clip-text text-5xl font-bold tracking-tight text-transparent sm:text-6xl lg:text-7xl">
        NextGen Facade AI
      </h1>

      <p className="mx-auto mt-6 max-w-2xl text-lg text-white/50 sm:text-xl">
        AI Powered Facade Material Intelligence Platform
      </p>

      <div className="relative mx-auto mt-12 max-w-2xl">
        <SearchBar navigateOnSubmit showShortcut />
      </div>
    </div>
  );
}
