import { env, requireEnv } from "@/lib/env";

export async function synthesizeSpeech(input: {
  text: string;
  speaker: "agent" | "rep";
  language?: string;
}): Promise<Buffer> {
  const voice =
    input.speaker === "agent" ? env.XAI_VOICE_AGENT : env.XAI_VOICE_REP;
  const key = requireEnv("XAI_API_KEY");
  const voices = [voice, "eve"].filter((v, i, a) => a.indexOf(v) === i);
  let last = "";
  for (const voiceId of voices) {
    const res = await fetch("https://api.x.ai/v1/tts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        text: input.text,
        voice_id: voiceId,
        language: input.language ?? "en",
      }),
    });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    last = `${res.status}: ${await res.text()}`;
  }
  throw new Error(`xAI TTS failed: ${last}`);
}
