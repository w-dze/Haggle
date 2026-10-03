"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function StartCallButton({
  caseId,
  lang,
  label,
  errorLabel,
}: {
  caseId: string;
  lang: string;
  label: string;
  errorLabel: string;
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
        body: JSON.stringify({ case_file_id: caseId, lang }),
      });
      const json = (await res.json()) as { ok: boolean; data?: { call_id: string }; error?: { message_i18n?: Record<string, string> } };
      if (!json.ok || !json.data?.call_id) {
        throw new Error(json.error?.message_i18n?.[lang] ?? json.error?.message_i18n?.en ?? errorLabel);
      }
      router.push(`/${lang}/call/${json.data.call_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : errorLabel);
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className="btn-approve bg-accent text-background disabled:opacity-60"
      >
        {busy ? "…" : label}
      </button>
      {error && <p className="text-danger text-sm">{error}</p>}
    </div>
  );
}
