import { SiteHeader } from "@/components/site/site-header";

// Website pages (home, /demo). The app itself lives under /[lang] with its
// own phone-style shell.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <SiteHeader />
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
