import Link from "next/link";
import { NavLink } from "./nav-link";

// Website header: same look as the app's header (serif wordmark, tracked
// caption on the right, honesty strip underneath) plus the site navigation.
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-background/95 backdrop-blur">
      <div className="mx-auto grid h-14 w-full max-w-6xl grid-cols-[1fr_auto_1fr] items-center px-4 md:px-8">
        <nav aria-label="Main" className="flex items-center gap-6">
          <NavLink href="/demo">Demo</NavLink>
        </nav>
        <Link href="/" className="font-display text-[26px] leading-none">
          Haggle
        </Link>
        <span className="justify-self-end text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
          EN
        </span>
      </div>
      {/* Demo honesty strip (§7.6). */}
      <p className="flex h-[27px] items-center justify-center border-t border-line text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
        Demo · mock data
      </p>
    </header>
  );
}
