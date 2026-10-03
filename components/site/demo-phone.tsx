"use client";

import { useState } from "react";
import { DeviceFrame } from "@/components/ui/phone-frame";

// The app in an iframe inside a phone frame. ?mock=1 runs the scripted
// walkthrough: no backend, phone number or API keys, and no real call.
export function DemoPhone() {
  // Changing the key remounts the iframe, restarting the walkthrough.
  const [run, setRun] = useState(0);

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Screen height: viewport minus site header (84px), page padding and bezel. */}
      <DeviceFrame screenClassName="w-[375px] max-w-[calc(100vw-56px)] h-[min(812px,calc(100dvh-84px-48px-24px-60px))]">
        <iframe
          key={run}
          src="/en?mock=1"
          title="Haggle app demo"
          className="block size-full border-0"
        />
      </DeviceFrame>
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-center text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
        <span className="hidden sm:inline">Scripted walkthrough · no real call</span>
        <button
          type="button"
          onClick={() => setRun((n) => n + 1)}
          className="h-11 whitespace-nowrap rounded-full border border-line px-4 uppercase hover:bg-foreground/5 hover:text-foreground"
        >
          Restart demo
        </button>
      </div>
    </div>
  );
}
