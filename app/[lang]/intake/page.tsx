"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { getTranslator, type Locale } from "@/lib/i18n";

type ApiOk<T> = { ok: true; data: T };
type ApiErr = { ok: false; error?: { message_i18n?: Record<string, string> } };

function apiMessage(json: ApiErr, lang: string, fallback: string): string {
  const i18n = json.error?.message_i18n;
  return i18n?.[lang] ?? i18n?.en ?? fallback;
}

async function postJson<T>(url: string, body: unknown, lang: string, fallback: string): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as ApiOk<T> | ApiErr;
  if (!json.ok) throw new Error(apiMessage(json, lang, fallback));
  return json.data;
}

export default function Intake() {
  const params = useParams<{ lang: string }>();
  const lang = params.lang as Locale;
  const t = getTranslator(lang);
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError(t("intake_need_photo"));
      return;
    }
    if (!goal.trim()) {
      setError(t("intake_need_goal"));
      return;
    }

    setBusy(true);
    try {
      const form = new FormData();
      form.append("image", file);
      form.append("lang", lang);
      const ocrRes = await fetch("/api/bills/ocr", { method: "POST", body: form });
      const ocrJson = (await ocrRes.json()) as ApiOk<{ bill_id: string }> | ApiErr;
      if (!ocrJson.ok) {
        throw new Error(apiMessage(ocrJson, lang, t("intake_error")));
      }

      const created = await postJson<{ case_file_id: string }>(
        "/api/case-files",
        {
          bill_id: ocrJson.data.bill_id,
          goal_text: goal.trim(),
          lang,
        },
        lang,
        t("intake_error"),
      );

      router.push(`/${lang}/case/${created.case_file_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("intake_error"));
      setBusy(false);
    }
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={onSubmit}>
      <h1 className="text-2xl font-bold">{t("intake_title")}</h1>

      <section className="rounded-xl border border-foreground/10 p-4 flex flex-col gap-3">
        <label className="font-medium" htmlFor="bill-photo">
          {t("intake_upload")}
        </label>
        <label className="h-32 rounded-lg border border-dashed border-foreground/20 grid place-items-center text-muted cursor-pointer hover:bg-foreground/5">
          <input
            id="bill-photo"
            type="file"
            accept="image/*,application/pdf"
            capture="environment"
            className="sr-only"
            disabled={busy}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {file ? file.name : t("intake_choose_file")}
        </label>
      </section>

      <section className="flex flex-col gap-2">
        <label className="font-medium" htmlFor="goal">
          {t("intake_goal_label")}
        </label>
        <textarea
          id="goal"
          className="rounded-lg bg-foreground/5 border border-foreground/10 p-3 min-h-24"
          placeholder={t("intake_goal_placeholder")}
          value={goal}
          disabled={busy}
          onChange={(e) => setGoal(e.target.value)}
        />
      </section>

      {error && <p className="text-danger text-sm">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="btn-approve bg-accent text-background disabled:opacity-60"
      >
        {busy ? t("intake_analyzing") : t("intake_analyze")}
      </button>
    </form>
  );
}
