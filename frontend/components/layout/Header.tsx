import Link from "next/link";
import { Logo } from "@/components/layout/Logo";
import { Button } from "@/components/ui/Button";

const NAV_LINKS = [
  { href: "/search", label: "Materials" },
  { href: "/manufacturers", label: "Manufacturers" },
  { href: "/compare", label: "Compare" },
  { href: "/datasheets", label: "Datasheets" },
  { href: "/knowledge", label: "Knowledge" },
  { href: "/admin/import", label: "Import" },
  { href: "/admin/import-history", label: "History" },
];

/** Top navigation bar with logo, links, and login button. */
export function Header() {
  return (
    <header className="relative z-10 border-b border-white/[0.08] bg-[#0B1120]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <Logo />
          <span className="text-sm font-semibold tracking-tight text-white sm:text-base">
            NextGen Facade AI
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm text-white/50 transition-colors hover:bg-white/5 hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <Button variant="outline" size="sm">
          Login
        </Button>
      </div>
    </header>
  );
}

export { NAV_LINKS };
