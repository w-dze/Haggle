import { notFound } from "next/navigation";
import { getTranslator, isLocale } from "@/lib/i18n";
import { BackButton } from "./back-button";

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getTranslator(lang);

  return (
    <div data-lang={lang} className="min-h-screen">
      {/* Demo honesty banner (§7.6). Keep this visible for judges. */}
      <div className="w-full bg-amber-500/10 text-amber-300 text-center text-sm py-1 border-b border-amber-500/20">
        Demo — mock data
      </div>
      <main className="mx-auto max-w-screen-sm px-4 py-6">
        <BackButton lang={lang} label={t("back")} />
        {children}
      </main>
    </div>
  );
}
