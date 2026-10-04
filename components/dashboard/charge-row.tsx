import Link from "next/link";
import { getTranslator } from "@/lib/i18n";
import type { Lang } from "@/lib/llm/templates";
import { money } from "@/lib/llm/facts";
import { mockHref } from "@/lib/mock-call";
import type { MerchantView } from "@/lib/dashboard";
import { MiniBars } from "./mini-bars";
import { StatusChip } from "./chips";

const STATUS = { normal: "status_normal", changed: "status_changed", new: "status_new", resolved: "status_resolved" } as const;

// One line per merchant: name, 12-month bars, typical amount, status.
// Cadence and dates live on the merchant's history page.
export function ChargeRow({ m, lang, mock }: { m: MerchantView; lang: Lang; mock: boolean }) {
  const t = getTranslator(lang);
  return (
    <li>
      <Link
        href={mockHref(`/${lang}/dashboard/merchant/${m.merchant}`, mock)}
        className="flex min-h-14 items-center gap-3 px-4 py-2.5 hover:bg-foreground/5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground"
      >
        <span className="min-w-0 flex-1 font-medium leading-snug">{m.display}</span>
        <MiniBars monthly={m.monthly} changeMonth={m.changeMonth} label={`${m.display}, ${t("months_chart")}`} lang={lang} width={52} height={20} />
        <span className="flex w-[78px] shrink-0 flex-col items-end gap-1">
          <span className="font-semibold tabular-nums">{money(m.typicalCents)}</span>
          {m.status !== "normal" && <StatusChip status={m.status} label={t(STATUS[m.status])} />}
        </span>
      </Link>
    </li>
  );
}
