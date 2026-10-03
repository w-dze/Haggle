import { NextRequest } from "next/server";
import { z } from "zod";
import { failMsg } from "@/lib/response";
import { synthesizeSpeech } from "@/lib/xai/tts";

export const runtime = "nodejs";

const Body = z.object({
  text: z.string().min(1).max(2000),
  speaker: z.enum(["agent", "rep"]),
  language: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return failMsg("bad_request", parsed.error.message, 400);
  try {
    const audio = await synthesizeSpeech(parsed.data);
    return new Response(new Uint8Array(audio), {
      headers: {
        "content-type": "audio/mpeg",
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    return failMsg("tts_failed", String(err), 502);
  }
}
