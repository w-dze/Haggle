import Link from "next/link";
import { getTranslator, LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n";
import { mockHref } from "@/lib/mock-call";

// Screen 1 — language picker / landing (§5.8).
export default async function Landing({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ mock?: string }>;
}) {
  const { lang } = await params;
  const mock = (await searchParams).mock === "1";
  const t = getTranslator(lang);

  return (
    <div className="flex flex-col gap-8 px-4 pt-6 pb-8">
      <header className="text-center mt-8">
        <h1 className="text-4xl font-bold">{t("appName")}</h1>
        <p className="mt-3 text-muted text-lg">{t("tagline")}</p>
      </header>

      <section className="flex flex-col gap-3">
        <p className="text-center text-sm text-muted">{t("choose_language")}</p>
        <div className="grid grid-cols-1 gap-3">
          {(LOCALES as readonly Locale[]).map((l) => (
            <Link
              key={l}
              href={mockHref(`/${l}/intake`, mock)}
              className="btn-approve bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 flex items-center justify-center"
            >
              {LOCALE_LABELS[l]}
            </Link>
          ))}
        </div>
      </section>

      <footer className="text-center">
        <Link href={`/${lang}/history`} className="text-sm text-muted underline">
          {t("history_title")}
        </Link>
      </footer>
    </div>
  );
}
