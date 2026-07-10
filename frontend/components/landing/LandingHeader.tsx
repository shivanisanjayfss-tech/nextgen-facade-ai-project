import Link from "next/link";
import { Logo } from "@/components/layout/Logo";
import { Button } from "@/components/ui/Button";

/** Landing page header — identical to original, extracted for reuse. */
export function LandingHeader() {
  return (
    <header className="relative z-10 border-b border-white/[0.08] bg-[#0B1120]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <Logo />
          <span className="text-sm font-semibold tracking-tight text-white sm:text-base">
            NextGen Facade AI
          </span>
        </Link>
        <Button variant="outline" size="sm">
          Login
        </Button>
      </div>
    </header>
  );
}
