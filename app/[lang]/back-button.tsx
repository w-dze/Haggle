"use client";

import { usePathname, useRouter } from "next/navigation";

// Shown on every screen after the language picker so users can step back
// (and ultimately return to the picker to change language).
export function BackButton({ lang, label }: { lang: string; label: string }) {
  const router = useRouter();
  const pathname = usePathname();

  // The picker itself lives at /[lang]; nothing to go back to from there.
  if (pathname === `/${lang}`) return null;

  function goBack() {
    // Deep links (e.g. a shared /es/case/123) have no in-app history, so fall
    // back to the language picker instead of leaving the site.
    if (window.history.length > 1) router.back();
    else router.push(`/${lang}`);
  }

  return (
    <button
      type="button"
      onClick={goBack}
      className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
    >
      <span aria-hidden="true">←</span> {label}
    </button>
  );
}
