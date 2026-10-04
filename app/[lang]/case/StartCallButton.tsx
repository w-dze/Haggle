"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function StartCallButton({
  caseId,
  lang,
  label,
  errorLabel,
  mode = "simulated",
  variant,
}: {
  caseId: string;
  lang: string;
  label: string;
  errorLabel: string;
  mode?: "simulated" | "live";
  variant?: "secondary";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/calls", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ case_file_id: caseId, lang, mode }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        data?: { call_id: string };
        error?: { message_i18n?: Record<string, string> };
      };
      if (!json.ok || !json.data?.call_id) {
        throw new Error(json.error?.message_i18n?.[lang] ?? json.error?.message_i18n?.en ?? errorLabel);
      }
      try {
        sessionStorage.setItem(`haggle-case-${json.data.call_id}`, caseId);
      } catch {
        /* ignore */
      }
      router.push(`/${lang}/call/${json.data.call_id}${mode === "live" ? "?live=1" : ""}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : errorLabel);
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" size="lg" variant={variant} onClick={start} disabled={busy}>
        {busy ? "…" : label}
      </Button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
