"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
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

/** Current profile (avatar + first name + language). Tapping it reopens the picker. */
export function ProfileChip({
  lang,
  name,
  first,
  initials,
  tint,
  label,
}: {
  lang: string;
  name: string;
  first: string;
  initials: string;
  tint: string;
  label: string;
}) {
  const mock = useSearchParams().get("mock") === "1";
  // No profile is chosen yet while the picker itself is open.
  if (usePathname() === `/${lang}`) return null;
  return (
    <Link
      href={mockHref(`/${lang}?pick=1`, mock)}
      aria-label={`${name} · ${label}`}
      title={`${name} · ${label}`}
      className="flex h-11 max-w-full items-center justify-end gap-2 rounded-full pr-2 pl-1 hover:bg-foreground/5"
    >
      <span
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tracking-wide text-[#262933]"
        style={{ background: tint }}
      >
        {initials}
      </span>
      <span className="flex min-w-0 flex-col items-start leading-tight">
        <span className="max-w-[72px] truncate text-[13px] font-medium">{first}</span>
        <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted">{lang}</span>
      </span>
    </Link>
  );
}
