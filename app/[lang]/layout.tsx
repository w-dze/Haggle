import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslator, isLocale } from "@/lib/i18n";
import { PhoneFrame } from "@/components/ui/phone-frame";
import { BackButton } from "./back-button";
import { ChangeLanguage, HomeLink } from "./header-links";

// App shell for every /[lang] screen. Fills its container (the full viewport on
// phones, a phone-shaped frame on desktop) with the content scrolling inside
// <main>, so screens can pin their own footers and it renders the same inside
// the /demo iframe.
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
    <PhoneFrame>
      <div data-lang={lang} lang={lang} className="flex h-full flex-col bg-background">
        <header
          data-app-chrome
          className="flex-none border-b border-line pt-[env(safe-area-inset-top,0px)]"
        >
          <div className="mx-auto flex h-14 w-full max-w-screen-sm items-center justify-between pr-1 pl-2">
            <div className="w-[64px]">
              <Suspense fallback={null}>
                <BackButton label={t("back")} />
              </Suspense>
            </div>
            <Suspense fallback={<span className="font-display text-[26px] leading-none">{t("appName")}</span>}>
              <HomeLink lang={lang} label={t("appName")} />
            </Suspense>
            <div className="w-[64px]">
              <Suspense fallback={null}>
                <ChangeLanguage lang={lang} label={t("change_language")} />
              </Suspense>
            </div>
          </div>
        </header>
        {/* Demo honesty banner (§7.6). Keep this visible for judges. */}
        <p
          data-app-chrome
          className="flex h-[27px] flex-none items-center justify-center border-b border-line text-[10px] font-medium uppercase tracking-[0.14em] text-muted"
        >
          {t("demo_banner")}
        </p>
        <main className="mx-auto flex min-h-0 w-full max-w-screen-sm flex-1 flex-col overflow-y-auto">
          {children}
        </main>
      </div>
    </PhoneFrame>
  );
}
