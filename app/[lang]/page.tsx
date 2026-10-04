import { getTranslator, LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n";
import { mockHref } from "@/lib/mock-call";
import { Button } from "@/components/ui/button";
import { chooseLanguage } from "./actions";

// Screen 1 — language picker (§5.8). Shown on the first visit only: choosing
// a language saves it (cookie + Neon) and later visits go straight to the
// dashboard (see middleware.ts). "Change language" reopens it with ?pick=1.
// In mock mode (the /demo phone frame) nothing is saved.
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
      <header className="mt-8 text-center">
        <h1 className="text-4xl">{t("appName")}</h1>
        <p className="mt-3 text-lg text-muted">{t("tagline")}</p>
      </header>

      <section className="flex flex-col gap-3">
        <p className="text-center text-sm text-muted">{t("choose_language")}</p>
        {mock ? (
          <div className="grid grid-cols-1 gap-3">
            {(LOCALES as readonly Locale[]).map((l) => (
              <Button key={l} href={mockHref(`/${l}/dashboard`, true)} size="lg" variant="secondary" lang={l}>
                {LOCALE_LABELS[l]}
              </Button>
            ))}
          </div>
        ) : (
          <form action={chooseLanguage} className="grid grid-cols-1 gap-3">
            {(LOCALES as readonly Locale[]).map((l) => (
              <Button key={l} type="submit" name="lang" value={l} size="lg" variant="secondary" lang={l}>
                {LOCALE_LABELS[l]}
              </Button>
            ))}
          </form>
        )}
      </section>

      <footer className="text-center">
        <Button href={mockHref(`/${lang}/history`, mock)} variant="ghost">
          {t("history_title")}
        </Button>
      </footer>
    </div>
  );
}
