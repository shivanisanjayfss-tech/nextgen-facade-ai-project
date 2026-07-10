import { AmbientBackground } from "@/components/layout/AmbientBackground";
import { Footer } from "@/components/layout/Footer";
import { LandingFeatures } from "@/components/landing/LandingFeatures";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { LandingHero } from "@/components/landing/LandingHero";

/** Full landing page composition — preserves original design exactly. */
export function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0B1120] text-white">
      <AmbientBackground />
      <LandingHeader />
      <main className="relative z-10 mx-auto max-w-6xl px-4 pb-24 pt-16 sm:px-6 sm:pt-24 lg:pt-32">
        <LandingHero />
        <LandingFeatures />
      </main>
      <Footer />
    </div>
  );
}
