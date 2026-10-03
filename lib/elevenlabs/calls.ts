import { requireEnv } from "@/lib/env";

// ElevenLabs Agents outbound call wrapper (§4.1, §4.4). ElevenLabs owns ASR,
// the LLM turn loop, TTS and telephony; our server only sees text + webhooks.
//
// [Verify V1] endpoint + payload. Expected (per PDR Appendix D):
//   POST /v1/convai/twilio/outbound-call
//   { agent_id, agent_phone_number_id, to_number,
//     conversation_initiation_client_data: { dynamic_variables } }

const BASE = "https://api.elevenlabs.io";

export type OutboundCallResult = {
  conversation_id?: string;
  callSid?: string;
  [k: string]: unknown;
};

export async function placeOutboundCall(input: {
  toNumber: string;
  dynamicVariables: Record<string, string>;
}): Promise<OutboundCallResult> {
  const res = await fetch(`${BASE}/v1/convai/twilio/outbound-call`, {
    method: "POST",
    headers: {
      "xi-api-key": requireEnv("ELEVENLABS_API_KEY"),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      agent_id: requireEnv("ELEVENLABS_AGENT_ID"),
      agent_phone_number_id: requireEnv("ELEVENLABS_PHONE_NUMBER_ID"),
      to_number: input.toNumber,
      conversation_initiation_client_data: {
        dynamic_variables: input.dynamicVariables,
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`ElevenLabs outbound-call ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

// Kill switch (§FR-24, GR-5) — [Verify V5] the correct end-conversation endpoint.
export async function endConversation(conversationId: string): Promise<void> {
  await fetch(`${BASE}/v1/convai/conversations/${conversationId}`, {
    method: "DELETE",
    headers: { "xi-api-key": requireEnv("ELEVENLABS_API_KEY") },
  }).catch(() => {
    /* best-effort; the UI also marks the call killed in the DB */
  });
}
