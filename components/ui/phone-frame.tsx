import type { ReactNode } from "react";

// On wide screens (md+), shows the app inside a phone-shaped device so it
// doesn't float in an empty desktop page. On real phones, and inside the
// 375px /demo iframe, it renders the app full-screen with no frame.
export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="h-dvh md:flex md:items-center md:justify-center md:bg-backdrop md:p-6">
      <div className="relative h-full md:h-[min(860px,calc(100dvh-48px))] md:w-[399px] md:rounded-[56px] md:bg-[#1a1c22] md:p-3 dark:md:bg-[#2b2e36] md:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.45)] md:ring-1 md:ring-black/10 dark:md:ring-white/10">
        <div className="flex h-full flex-col overflow-hidden bg-background md:rounded-[44px]">
          <StatusBar />
          <div className="min-h-0 flex-1">{children}</div>
        </div>
      </div>
    </div>
  );
}

// Always-on device frame for the website's /demo page. `screenClassName` sizes
// the screen (e.g. a fixed 375px width and a viewport-capped height).
export function DeviceFrame({
  children,
  screenClassName,
}: {
  children: ReactNode;
  screenClassName?: string;
}) {
  return (
    <div className="rounded-[56px] bg-[#1a1c22] p-3 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.45)] ring-1 ring-black/10 dark:bg-[#2b2e36] dark:ring-white/10">
      <div
        className={`flex flex-col overflow-hidden rounded-[44px] bg-background ${screenClassName ?? ""}`}
      >
        <StatusBar always />
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

// Decorative iOS-style status bar. In the app's own frame it only shows on
// desktop (md+); in DeviceFrame it always shows.
function StatusBar({ always = false }: { always?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`relative h-11 flex-none items-center justify-between px-7 text-[15px] font-semibold ${always ? "flex" : "hidden md:flex"}`}
    >
      <span className="tabular-nums">9:41</span>
      <span className="absolute top-2.5 left-1/2 h-[30px] w-[110px] -translate-x-1/2 rounded-full bg-black" />
      <span className="flex items-center gap-1.5">
        <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor">
          <rect x="0" y="8" width="3" height="4" rx="0.8" />
          <rect x="5" y="5.5" width="3" height="6.5" rx="0.8" />
          <rect x="10" y="3" width="3" height="9" rx="0.8" />
          <rect x="15" y="0" width="3" height="12" rx="0.8" />
        </svg>
        <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor">
          <path d="M8 2.2c2.3 0 4.4.9 6 2.4l1.3-1.4A10.4 10.4 0 0 0 8 .2 10.4 10.4 0 0 0 .7 3.2L2 4.6a8.4 8.4 0 0 1 6-2.4Zm0 3.6c1.3 0 2.5.5 3.4 1.3l1.3-1.4A7 7 0 0 0 8 3.8a7 7 0 0 0-4.7 1.9l1.3 1.4C5.5 6.3 6.7 5.8 8 5.8Zm0 3.4c-.6 0-1.1.2-1.5.6L8 11.5l1.5-1.7c-.4-.4-.9-.6-1.5-.6Z" />
        </svg>
        <svg width="27" height="13" viewBox="0 0 27 13" fill="none">
          <rect x="0.5" y="0.5" width="23" height="12" rx="3.5" stroke="currentColor" opacity="0.4" />
          <rect x="2" y="2" width="20" height="9" rx="2" fill="currentColor" />
          <path d="M25 4.5v4c.8-.3 1.3-1.1 1.3-2s-.5-1.7-1.3-2Z" fill="currentColor" opacity="0.4" />
        </svg>
      </span>
    </div>
  );
}
