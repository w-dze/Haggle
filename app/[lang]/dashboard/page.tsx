import { getTranslator } from "@/lib/i18n";
import { mockHref } from "@/lib/mock-call";
import { Button } from "@/components/ui/button";

// The app's home after the language is chosen. Phase 5 fills this with the
// "Looks off" and "Your typical charges" sections.
export default async function Dashboard({
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
    <div className="flex flex-col gap-6 px-4 pt-6 pb-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl">{t("dashboard_title")}</h1>
        <p className="text-muted">{t("dashboard_placeholder")}</p>
      </header>
      <Button href={mockHref(`/${lang}/intake`, mock)} size="lg">
        {t("dashboard_check_bill")}
      </Button>
      <footer className="text-center">
        <Button href={mockHref(`/${lang}/history`, mock)} variant="ghost">
          {t("history_title")}
        </Button>
      </footer>
    </div>
  );
}
