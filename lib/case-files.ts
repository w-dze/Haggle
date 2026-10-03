import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { caseFiles } from "@/lib/db/schema";
import { CaseFile } from "@/lib/schemas";
import { centsToDollars } from "@/lib/money";

export type StoredCase = {
  id: string;
  status: string | null;
  caseFile: CaseFile;
  explanationI18n: Record<string, string>;
  walkawayCents: number;
  currentCents: number;
  targetCents: number;
};

export async function loadStoredCase(id: string): Promise<StoredCase | null> {
  const db = getDb();
  const [row] = await db.select().from(caseFiles).where(eq(caseFiles.id, id)).limit(1);
  if (!row) return null;

  const stored = (row.explanationI18n ?? {}) as Record<string, unknown>;
  const fromJson = CaseFile.safeParse(stored.case_file);
  const caseFile: CaseFile = fromJson.success
    ? fromJson.data
    : {
        account_holder_name: "",
        provider: "",
        service: "",
        account_last4: "0000",
        current_monthly: centsToDollars(row.currentCents ?? 0),
        target_monthly: centsToDollars(row.targetCents ?? 0),
        walkaway_monthly: centsToDollars(row.walkawayCents ?? 0),
        issues: [],
        leverage: (row.leverage as string[]) ?? [],
        competitor_offers: (row.competitorOffers as CaseFile["competitor_offers"]) ?? [],
        allowed_concessions: (row.allowedConcessions as string[]) ?? [],
        forbidden: (row.forbidden as string[]) ?? [],
      };

  const explanationI18n = Object.fromEntries(
    Object.entries(stored).filter(([, v]) => typeof v === "string"),
  ) as Record<string, string>;

  return {
    id: row.id,
    status: row.status,
    caseFile,
    explanationI18n,
    walkawayCents: row.walkawayCents ?? 0,
    currentCents: row.currentCents ?? 0,
    targetCents: row.targetCents ?? 0,
  };
}
