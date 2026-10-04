"use client";

import { useParams } from "next/navigation";
import { getTranslator } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  const { lang } = useParams<{ lang: string }>();
  const t = getTranslator(lang);
  return (
    <div className="px-4 pt-6 pb-8">
      <Card className="flex flex-col items-start gap-3">
        <p role="alert">{t("dashboard_error")}</p>
        <Button variant="secondary" onClick={reset}>
          {t("dashboard_retry")}
        </Button>
      </Card>
    </div>
  );
}
