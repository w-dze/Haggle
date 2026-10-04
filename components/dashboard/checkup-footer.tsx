import Link from "next/link";
import { getTranslator } from "@/lib/i18n";
import { mockHref } from "@/lib/mock-call";
import type { DataSource } from "@/lib/data-source";
import { toggleInbox } from "@/app/[lang]/dashboard/actions";

// Compact footer: secondary pages, the read-only inbox control, which bank
// data source is active, and the demo honesty strip.
export function CheckupFooter({
  lang,
  mock,
  inboxOff,
  source,
}: {
  lang: string;
  mock: boolean;
  inboxOff: boolean;
  source: DataSource;
}) {
  const t = getTranslator(lang);
  const link = "flex min-h-11 items-center text-sm text-muted underline-offset-4 hover:text-foreground hover:underline";
  const action = "min-h-11 font-medium text-foreground underline underline-offset-4";
  return (
    <footer className="flex flex-col gap-2 border-t border-line pt-3">
      <nav aria-label={t("dashboard_title")} className="flex flex-wrap gap-x-4">
        <Link href={mockHref(`/${lang}/intake`, mock)} className={link}>
          {t("dashboard_check_bill")}
        </Link>
        <Link href={mockHref(`/${lang}/history`, mock)} className={link}>
          {t("history_title")}
        </Link>
        <Link href={mockHref(`/${lang}/receipts`, mock)} className={link}>
          {t("footer_receipts")}
        </Link>
        <Link href={mockHref(`/${lang}/audit`, mock)} className={link}>
          {t("footer_audit")}
        </Link>
      </nav>

      <div className="flex flex-wrap items-center gap-x-2 text-sm text-muted">
        <span>{inboxOff ? t("inbox_disconnected") : t("inbox_connected")} ·</span>
        {mock ? (
          <Link href={mockHref(`/${lang}/dashboard${inboxOff ? "" : "?inbox=off"}`, true)} className={`${action} content-center`}>
            {inboxOff ? t("inbox_reconnect") : t("inbox_disconnect")}
          </Link>
        ) : (
          <form action={toggleInbox}>
            <input type="hidden" name="off" value={inboxOff ? "0" : "1"} />
            <input type="hidden" name="lang" value={lang} />
            <button type="submit" className={action}>
              {inboxOff ? t("inbox_reconnect") : t("inbox_disconnect")}
            </button>
          </form>
        )}
      </div>

      <p className="pt-1 text-[11px] leading-relaxed text-muted">
        {source === "nessie" ? t("source_nessie") : t("source_fixture")}. {t("honesty_strip")}
      </p>
    </footer>
  );
}
