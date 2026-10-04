"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { mockHref } from "@/lib/mock-call";

// Links to a fixed parent screen rather than calling history.back(): inside an
// iframe the session history is shared with the parent page, so going "back"
// could navigate the parent away. Real calls store the case id separately
// because the call UUID is not the case-file id.
function parentHref(pathname: string, fromCheckup: boolean): string | null {
  const [lang, section, id] = pathname.split("/").filter(Boolean);
  if (!lang || !section) return null;
  switch (section) {
    case "dashboard":
      // The dashboard is home; its merchant history pages go back to it.
      return id ? `/${lang}/dashboard` : null;
    case "intake":
      return `/${lang}/dashboard`;
    case "case":
      return fromCheckup ? `/${lang}/dashboard` : `/${lang}/intake`;
    case "call":
      if (id) {
        try {
          const caseId = sessionStorage.getItem(`haggle-case-${id}`);
          if (caseId) return `/${lang}/case/${caseId}`;
        } catch {
          /* ignore */
        }
        return `/${lang}/case/${id}`;
      }
      return `/${lang}/intake`;
    case "debrief":
      return `/${lang}/history`;
    case "history":
    case "receipts":
    case "audit":
      return `/${lang}/dashboard`;
    default:
      return `/${lang}`;
  }
}

export function BackButton({ label }: { label: string }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const mock = search.get("mock") === "1";
  const href = parentHref(pathname, search.get("from") === "checkup");
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
