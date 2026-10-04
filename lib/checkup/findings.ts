import { detect } from "@/lib/detect/index";
import { inputFromPersona } from "@/lib/detect/adapt";
import type { BillEventFact, DetectResult, Dismissal, Finding } from "@/lib/detect/types";
import { fixturePersona, loadPersonaData, type DataSource } from "@/lib/data-source";
import { readDemoInbox } from "@/lib/inbox/fixture";
import { extractBillEvent } from "@/lib/inbox/extract";

// Runs the detector over Maria's current data. Finding ids are deterministic,
// so any finding can be looked up again by id without storing it first.

export function demoBillEvents(): BillEventFact[] {
  return readDemoInbox().map((m) => extractBillEvent(m));
}

export type ChargeRecord = { id: string; date: string; amountCents: number; merchantRaw: string };

export type Detection = DetectResult & {
  source: DataSource;
  sourceReason: string;
  billEvents: BillEventFact[];
  charges: Map<string, ChargeRecord>;
};

export async function currentDetection(
  opts: { mock?: boolean; dismissals?: Dismissal[]; inboxOff?: boolean } = {},
): Promise<Detection> {
  const data = opts.mock ? fixturePersona() : await loadPersonaData();
  const billEvents = opts.inboxOff ? [] : demoBillEvents();
  const input = inputFromPersona(data, billEvents, opts.dismissals ?? []);
  const result = detect(input);
  return {
    ...result,
    source: data.source,
    sourceReason: data.reason,
    billEvents,
    charges: new Map(input.charges.map((c) => [c.id, { id: c.id, date: c.date, amountCents: c.amountCents, merchantRaw: c.merchantRaw }])),
  };
}

/** Look a finding up by id, ignoring dismissals (so dismissed ones are found too). */
export async function findingById(id: string, opts: { mock?: boolean } = {}): Promise<Finding | null> {
  const { findings } = await currentDetection(opts);
  return findings.find((f) => f.id === id) ?? null;
}
