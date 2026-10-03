"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { mockHref } from "@/lib/mock-call";

// Links to a fixed parent screen rather than calling history.back(): inside an
// iframe the session history is shared with the parent page, so going "back"
// could navigate the parent away.
function parentHref(pathname: string): string | null {
  const [lang, section, id] = pathname.split("/").filter(Boolean);
  if (!lang || !section) return null; // the picker itself has no parent
  switch (section) {
    case "case":
      return `/${lang}/intake`;
    case "call":
      return id ? `/${lang}/case/${id}` : `/${lang}`;
    default: // intake, debrief, history
      return `/${lang}`;
  }
}

export function BackButton({ label }: { label: string }) {
  const pathname = usePathname();
  const mock = useSearchParams().get("mock") === "1";
  const href = parentHref(pathname);
  if (!href) return null;

  return (
    <Link
      href={mockHref(href, mock)}
      aria-label={label}
      className="flex size-11 items-center justify-center text-foreground"
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M15 5l-7 7 7 7" />
      </svg>
    </Link>
  );
}
