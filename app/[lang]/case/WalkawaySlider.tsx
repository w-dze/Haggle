"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/money";

export function WalkawaySlider({
  caseId,
  lang,
  initialCents,
  maxDollars,
  label,
  savedLabel,
}: {
  caseId: string;
  lang: string;
  initialCents: number;
  maxDollars: number;
  label: string;
  savedLabel: string;
}) {
  const [dollars, setDollars] = useState(Math.round(initialCents / 100));
  const [saved, setSaved] = useState(true);

  async function persist(next: number) {
    setDollars(next);
    setSaved(false);
    await fetch(`/api/case-files/${caseId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ walkaway_cents: next * 100 }),
    });
    setSaved(true);
  }

  return (
    <section className="flex flex-col gap-2">
      <label className="font-medium" htmlFor="walkaway">
        {label}
      </label>
      <p className="text-lg font-semibold">{formatMoney(dollars * 100, lang)}</p>
      <input
        id="walkaway"
        type="range"
        min={0}
        max={Math.max(maxDollars, 1)}
        value={dollars}
        className="w-full"
        onChange={(e) => {
          setDollars(Number(e.target.value));
          setSaved(false);
        }}
        onPointerUp={(e) => persist(Number((e.target as HTMLInputElement).value))}
        onKeyUp={(e) => persist(Number((e.target as HTMLInputElement).value))}
      />
      <p className="text-xs text-muted">{saved ? savedLabel : "…"}</p>
    </section>
  );
}
