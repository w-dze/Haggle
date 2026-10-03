import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

// HMAC verification for ElevenLabs post-call webhooks (§7.3, STRIDE spoofing).
// [Verify V4] the exact signature header name and format.
const TIMESTAMP_TOLERANCE_SEC = 30 * 60;

export function verifyWebhook(rawBody: string, signatureHeader: string | null): boolean {
  if (!env.ELEVENLABS_WEBHOOK_SECRET) return false;
  if (!signatureHeader) return false;

  // Expected format (ElevenLabs convention): "t=<ts>,v0=<hex>".
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => p.split("=") as [string, string]),
  );
  const ts = Number(parts["t"]);
  const sig = parts["v0"];
  if (!ts || !sig) return false;

  if (Math.abs(Date.now() / 1000 - ts) > TIMESTAMP_TOLERANCE_SEC) return false;

  const expected = createHmac("sha256", env.ELEVENLABS_WEBHOOK_SECRET)
    .update(`${ts}.${rawBody}`)
    .digest("hex");

  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Shared-secret check for server tool calls (§7.3). ElevenLabs sends a
// configured header value to /api/tools/*.
export function verifyToolSecret(headerValue: string | null): boolean {
  if (!env.TOOL_SHARED_SECRET) return false;
  if (!headerValue) return false;
  const a = Buffer.from(headerValue);
  const b = Buffer.from(env.TOOL_SHARED_SECRET);
  return a.length === b.length && timingSafeEqual(a, b);
}
