"use client";

import { usePathname, useRouter } from "next/navigation";

function parentPath(pathname: string, lang: string): string {
  const parts = pathname.split("/").filter(Boolean);
  const page = parts[1];
  const id = parts[2];
  if (page === "intake") return `/${lang}`;
  if (page === "case") return `/${lang}/intake`;
  if (page === "call" && id) {
    try {
      const caseId = sessionStorage.getItem(`haggle-case-${id}`);
      if (caseId) return `/${lang}/case/${caseId}`;
    } catch {
      /* ignore */
    }
    return `/${lang}/intake`;
  }
  if (page === "debrief") return `/${lang}/history`;
  if (page === "history") return `/${lang}`;
  return `/${lang}`;
}

export function BackButton({ lang, label }: { lang: string; label: string }) {
  const router = useRouter();
  const pathname = usePathname();

  if (pathname === `/${lang}`) return null;

  return (
    <button
      type="button"
      onClick={() => router.push(parentPath(pathname, lang))}
      className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
    >
      <span aria-hidden="true">←</span> {label}
    </button>
  );
}
