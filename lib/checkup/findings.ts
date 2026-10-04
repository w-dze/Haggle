import { detect } from "@/lib/detect/index";
import { inputFromPersona } from "@/lib/detect/adapt";
import type { DetectResult, Dismissal, Finding } from "@/lib/detect/types";
import { fixturePersona, loadPersonaData, type DataSource } from "@/lib/data-source";
import { readDemoInbox } from "@/lib/inbox/fixture";
import { extractBillEvent } from "@/lib/inbox/extract";

// Runs the detector over Maria's current data. Finding ids are deterministic,
// so any finding can be looked up again by id without storing it first.

export function demoBillEvents() {
  return readDemoInbox().map((m) => extractBillEvent(m));
}

export async function currentDetection(
  opts: { mock?: boolean; dismissals?: Dismissal[] } = {},
): Promise<DetectResult & { source: DataSource; sourceReason: string }> {
  const data = opts.mock ? fixturePersona() : await loadPersonaData();
  const result = detect(inputFromPersona(data, demoBillEvents(), opts.dismissals ?? []));
  return { ...result, source: data.source, sourceReason: data.reason };
}

export async function findingById(id: string, opts: { mock?: boolean } = {}): Promise<Finding | null> {
  const { findings } = await currentDetection(opts);
  return findings.find((f) => f.id === id) ?? null;
}
