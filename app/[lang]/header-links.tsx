"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { mockHref } from "@/lib/mock-call";

// Header links that keep ?mock=1, so the /demo phone frame stays in mock mode.

export function HomeLink({ lang, label }: { lang: string; label: string }) {
  const mock = useSearchParams().get("mock") === "1";
  return (
    <Link href={mockHref(`/${lang}/dashboard`, mock)} className="font-display text-[26px] leading-none">
      {label}
    </Link>
  );
}

/** Reopens the language picker. Shows the current language code with a globe. */
export function ChangeLanguage({ lang, label }: { lang: string; label: string }) {
  const mock = useSearchParams().get("mock") === "1";
  return (
    <Link
      href={mockHref(`/${lang}?pick=1`, mock)}
      aria-label={label}
      title={label}
      className="flex h-11 items-center justify-end gap-1 pr-3 text-[11px] font-medium uppercase tracking-[0.14em] text-muted hover:text-foreground"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
      </svg>
      {lang}
    </Link>
  );
}
