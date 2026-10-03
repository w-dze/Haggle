import Link from "next/link";
import { getTranslator } from "@/lib/i18n";
import { mockHref } from "@/lib/mock-call";

// Screen 3 — explanation + walk-away limit + Start call (§5.8, FR-9..FR-12).
// TODO(B/C): load the case file by id, render explanation_i18n[lang], the
// walk-away slider, and allowed-concession checkboxes. "Start call" -> POST /api/calls.
export default async function CasePage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; id: string }>;
  searchParams: Promise<{ mock?: string }>;
}) {
  const { lang, id } = await params;
  const mock = (await searchParams).mock === "1";
  const t = getTranslator(lang);

  return (
    <div className="flex flex-col gap-6 px-4 pt-6 pb-8">
      <h1 className="text-2xl font-bold">{t("case_title")}</h1>

      <div className="grid grid-cols-1 gap-3">
        <article className="rounded-xl border border-foreground/10 p-4">
          <h2 className="font-semibold">{t("case_you_pay")}</h2>
          <p className="text-muted text-sm mt-1">case_file:{id}</p>
        </article>
        <article className="rounded-xl border border-foreground/10 p-4">
          <h2 className="font-semibold">{t("case_looks_wrong")}</h2>
        </article>
        <article className="rounded-xl border border-foreground/10 p-4">
          <h2 className="font-semibold">{t("case_good_result")}</h2>
        </article>
      </div>

      <section className="flex flex-col gap-2">
        <label className="font-medium">{t("case_walkaway")}</label>
        {/* TODO: walk-away slider, prefilled from analyst suggestion; PATCH /api/case-files/:id */}
        <input type="range" min={0} max={200} defaultValue={65} className="w-full" />
      </section>

      <p className="text-xs text-muted">{t("case_consent")}</p>
      {/* Scripted demo: start the mock call instead of POST /api/calls. */}
      {mock ? (
        <Link
          href={mockHref(`/${lang}/call/${id}`, true)}
          className="btn-approve flex items-center justify-center bg-accent text-background"
        >
          {t("case_start_call")}
        </Link>
      ) : (
        <button className="btn-approve bg-accent text-background">{t("case_start_call")}</button>
      )}
    </div>
  );
}
