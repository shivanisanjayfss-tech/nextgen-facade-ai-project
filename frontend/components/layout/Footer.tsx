/** Site footer with copyright. */
export function Footer() {
  return (
    <footer className="relative z-10 border-t border-white/[0.06]">
      <div className="mx-auto max-w-6xl px-4 py-8 text-center text-sm text-white/25 sm:px-6">
        &copy; {new Date().getFullYear()} NextGen Facade AI. All rights reserved.
      </div>
    </footer>
  );
}
