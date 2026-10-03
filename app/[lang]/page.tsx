import { getTranslator, LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n";
import { mockHref } from "@/lib/mock-call";
import { Button } from "@/components/ui/button";

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
      <header className="mt-8 text-center">
        <h1 className="text-4xl">{t("appName")}</h1>
        <p className="mt-3 text-lg text-muted">{t("tagline")}</p>
      </header>

      <section className="flex flex-col gap-3">
        <p className="text-center text-sm text-muted">{t("choose_language")}</p>
        <div className="grid grid-cols-1 gap-3">
          {(LOCALES as readonly Locale[]).map((l) => (
            <Button key={l} href={mockHref(`/${l}/intake`, mock)} size="lg" variant="secondary">
              {LOCALE_LABELS[l]}
            </Button>
          ))}
        </div>
      </section>

      <footer className="text-center">
        <Button href={mockHref(`/${lang}/history`, mock)} variant="ghost">
          {t("history_title")}
        </Button>
      </footer>
    </div>
  );
}
