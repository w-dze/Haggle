import type { Metadata } from "next";
import { DemoPhone } from "@/components/site/demo-phone";

export const metadata: Metadata = { title: "Demo · Haggle" };

// The real app, running the scripted call, inside a phone frame.
export default function DemoPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-backdrop px-4 py-6">
      <DemoPhone />
    </div>
  );
}
