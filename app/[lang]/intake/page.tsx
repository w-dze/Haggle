"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getTranslator, type Locale } from "@/lib/i18n";
import { mockHref } from "@/lib/mock-call";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DropZone } from "@/components/ui/drop-zone";

type ApiOk<T> = { ok: true; data: T };
type ApiErr = { ok: false; error?: { message_i18n?: Record<string, string> } };

type Demo = {
  lang: string;
  name: string;
  customer_id: string;
  payee: string;
  monthly: number;
};

const FALLBACK_DEMOS: Demo[] = [
  {
    lang: "es",
    name: "Maria Lopez",
    customer_id: "af3d4ea0-d0c1-43fd-83ae-5f0b33e058af",
    payee: "Comcastic Internet",
    monthly: 89,
  },
  {
    lang: "zh",
    name: "Wei Chen",
    customer_id: "e8988647-f81b-4575-996e-94bc08b6ffd6",
    payee: "Comcastic Internet",
    monthly: 89,
  },
  {
    lang: "ko",
    name: "Jiwoo Kim",
    customer_id: "28b57f51-2dd4-4566-a89c-36c9bc98bfb5",
    payee: "Comcastic Internet",
    monthly: 89,
  },
];

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
  const mock = useSearchParams().get("mock") === "1";
  const lang = params.lang as Locale;
  const t = getTranslator(lang);
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [demos, setDemos] = useState<Demo[]>(FALLBACK_DEMOS);
  const [demoId, setDemoId] = useState<string | null>(null);
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/demo-accounts")
      .then((r) => r.json())
      .then((json: ApiOk<{ demos: Demo[] }> | ApiErr) => {
        if (json.ok && json.data.demos.length) setDemos(json.data.demos);
        else setDemos(FALLBACK_DEMOS);
      })
      .catch(() => setDemos(FALLBACK_DEMOS));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file && !demoId) {
      setError(t("intake_need_photo"));
      return;
    }
    if (!goal.trim()) {
      setError(t("intake_need_goal"));
      return;
    }

    setBusy(true);
    try {
      let billId: string;
      let nessieCustomerId: string | undefined;
      let preferLocal = false;

      if (demoId) {
        const imported = await postJson<{ bill_id: string; nessie_customer_id: string }>(
          "/api/bills/from-nessie",
          { customer_id: demoId },
          lang,
          t("intake_error"),
        );
        billId = imported.bill_id;
        nessieCustomerId = imported.nessie_customer_id;
        preferLocal = true;
      } else if (file) {
        const form = new FormData();
        form.append("image", file);
        form.append("lang", lang);
        const ocrRes = await fetch("/api/bills/ocr", { method: "POST", body: form });
        const ocrJson = (await ocrRes.json()) as ApiOk<{ bill_id: string }> | ApiErr;
        if (!ocrJson.ok) throw new Error(apiMessage(ocrJson, lang, t("intake_error")));
        billId = ocrJson.data.bill_id;
      } else {
        throw new Error(t("intake_need_photo"));
      }

      const created = await postJson<{ case_file_id: string }>(
        "/api/case-files",
        {
          bill_id: billId,
          goal_text: goal.trim(),
          lang,
          nessie_customer_id: nessieCustomerId,
          prefer_local: preferLocal,
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
    <form className="flex flex-col gap-6 px-4 pt-6 pb-8" onSubmit={onSubmit}>
      <h1 className="text-3xl">{t("intake_title")}</h1>

      <Card as="section" className="flex flex-col gap-3">
        <p className="font-medium">{t("intake_use_demo")}</p>
        {/* The current profile's account first. */}
        {[...(demos.length ? demos : FALLBACK_DEMOS)]
          .sort((a, b) => Number(b.lang === lang) - Number(a.lang === lang))
          .map((d) => (
          <button
            key={d.customer_id}
            type="button"
            disabled={busy}
            onClick={() => {
              setDemoId(d.customer_id);
              setFile(null);
              if (!goal.trim()) setGoal(t("intake_goal_placeholder"));
            }}
            className={`rounded-xl border px-3 py-3 text-left text-sm ${
              demoId === d.customer_id
                ? "border-accent bg-accent/10"
                : "border-line hover:bg-foreground/5"
            }`}
          >
            {d.name} · {d.payee} · ${d.monthly}/mo
          </button>
        ))}
        <label className="mt-2 font-medium" htmlFor="bill-photo">
          {t("intake_upload")}
        </label>
        <DropZone
          label={file ? file.name : t("intake_choose_file")}
          capture="environment"
          onFile={(next) => {
            setFile(next);
            setDemoId(null);
          }}
        />
      </Card>

      <section className="flex flex-col gap-2">
        <label className="font-medium" htmlFor="goal">
          {t("intake_goal_label")}
        </label>
        <textarea
          id="goal"
          className="min-h-24 rounded-xl border border-line bg-surface p-3"
          placeholder={t("intake_goal_placeholder")}
          value={goal}
          disabled={busy}
          onChange={(e) => setGoal(e.target.value)}
        />
      </section>

      {error && <p className="text-sm text-danger">{error}</p>}

      {mock ? (
        <Button href={mockHref(`/${lang}/case/demo`, true)} size="lg">
          {t("continue")}
        </Button>
      ) : (
        <Button type="submit" size="lg" disabled={busy}>
          {busy ? t("intake_analyzing") : t("intake_analyze")}
        </Button>
      )}
    </form>
  );
}
