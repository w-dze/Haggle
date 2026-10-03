import Link from "next/link";
import { getTranslator } from "@/lib/i18n";
import { debriefFromOutcome, loadCallOutcome } from "@/lib/outcomes";
import { formatMoney } from "@/lib/money";

export default async function DebriefPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  const t = getTranslator(lang);

  let packed: Awaited<ReturnType<typeof loadCallOutcome>> = null;
  try {
    packed = await loadCallOutcome(id);
  } catch {
    packed = null;
  }

  const debrief = packed?.outcome ? debriefFromOutcome(packed.outcome, lang) : null;
  const killed = packed?.call.status === "killed";
  const savingsCents = packed?.outcome?.annualSavingsCents ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t("debrief_title")}</h1>

      <div className="rounded-2xl border border-accent/30 bg-accent/5 p-6 flex flex-col gap-2">
        <span className="text-sm text-muted">{killed ? t("call_ended") : t("debrief_savings")}</span>
        <p className="text-3xl font-bold">
          {killed ? t("debrief_killed") : savingsCents ? formatMoney(savingsCents, lang) : "—"}
        </p>
        {debrief?.old_monthly != null && debrief.new_monthly != null && (
          <p className="text-muted text-sm">
            ${debrief.old_monthly} → ${debrief.new_monthly}
            {debrief.confirmation_ref ? ` · ${debrief.confirmation_ref}` : ""}
          </p>
        )}
      </div>

      {debrief?.prose && (
        <section className="rounded-xl border border-foreground/10 p-4">
          <p className="leading-relaxed">{debrief.prose}</p>
        </section>
      )}

      {debrief?.next_steps?.length ? (
        <section className="rounded-xl border border-foreground/10 p-4">
          <h2 className="font-semibold mb-2">{t("debrief_next")}</h2>
          <ul className="list-disc pl-5 text-muted space-y-1">
            {debrief.next_steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <Link href={`/${lang}/history`} className="text-sm underline text-muted">
        {t("debrief_view_audit")}
      </Link>
    </div>
  );
}
