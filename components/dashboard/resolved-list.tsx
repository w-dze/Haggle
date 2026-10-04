import Link from "next/link";
import { getTranslator } from "@/lib/i18n";
import { formatDate, type Lang } from "@/lib/llm/templates";
import type { ResolvedView } from "@/lib/dashboard";
import { Caption } from "@/components/ui/caption";
import { StatusChip } from "./chips";

// Findings whose call ended in a deal: the new price, yearly savings and
// confirmation, with a link to the call summary.
export function ResolvedList({ items, lang, index }: { items: ResolvedView[]; lang: Lang; mock: boolean; index: string }) {
  const t = getTranslator(lang);
  return (
    <section aria-labelledby="resolved" className="flex flex-col gap-2.5">
      <Caption as="h2" index={index} id="resolved">
        {t("dashboard_resolved")}
      </Caption>
      <ul className="flex flex-col gap-2">
        {items.map((r) => (
          <li key={r.findingId}>
            <Link
              href={`/${lang}/debrief/${r.callId}`}
              className="flex items-center gap-3 rounded-2xl border border-success/30 bg-success/5 px-4 py-3.5 hover:bg-success/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex items-center gap-2">
                  <span className="truncate font-semibold">{r.display}</span>
                  <StatusChip status="resolved" label={t("status_resolved")} />
                </span>
                <span className="text-[15px] leading-snug">{r.summary}</span>
                <span className="text-xs text-muted">
                  {[r.confirmation, r.date ? formatDate(r.date, lang) : null].filter(Boolean).join(" · ")}
                  {" · "}
                  <span className="underline underline-offset-2">{t("resolved_view")}</span>
                </span>
              </span>
              <span aria-hidden="true" className="shrink-0 text-xl text-muted">
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
