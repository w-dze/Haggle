import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslator, isLocale } from "@/lib/i18n";
import { PhoneFrame } from "@/components/ui/phone-frame";
import { BackButton } from "./back-button";
import { HomeLink, ProfileChip } from "./header-links";
import { profileFor } from "@/lib/profiles";

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
        {/* Stays visible inside the /demo phone (back button + profile); only the
            wordmark is hidden there because the website header already shows it. */}
        <header className="flex-none border-b border-line pt-[env(safe-area-inset-top,0px)]">
          <div className="mx-auto flex h-14 w-full max-w-screen-sm items-center justify-between pr-1 pl-2">
            <div className="w-[112px]">
              <Suspense fallback={null}>
                <BackButton label={t("back")} />
              </Suspense>
            </div>
            <div data-app-chrome>
              <Suspense fallback={<span className="font-display text-[26px] leading-none">{t("appName")}</span>}>
                <HomeLink lang={lang} label={t("appName")} />
              </Suspense>
            </div>
            <div className="flex w-[112px] justify-end">
              <Suspense fallback={null}>
                <ProfileChip {...profileFor(lang)} lang={lang} label={t("profile_change")} />
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
