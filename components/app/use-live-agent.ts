"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useConversation } from "@elevenlabs/react";

type SessionResponse = {
  ok: boolean;
  data?: { signed_url: string; dynamic_variables: Record<string, string> };
  error?: { message?: string };
};

/**
 * Runs the ElevenLabs negotiator in the browser. Whoever speaks into the mic
 * is the provider rep. Finished turns and the agent's approval request go to
 * our API; the page itself renders from the SSE stream like any other call.
 * Must be used inside a `ConversationProvider`.
 */
export function useLiveAgent(callId: string, lang: string, enabled: boolean) {
  const conversation = useConversation();
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  // Turns are posted one at a time so their seq order matches the call.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const finished = useRef(false);

  const post = useCallback(
    (path: string, body?: unknown) =>
      fetch(`/api/calls/${callId}/live/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    [callId],
  );

  const enqueue = useCallback(<T>(task: () => Promise<T>): Promise<T> => {
    const next = queue.current.then(task, task);
    queue.current = next.catch(() => undefined);
    return next;
  }, []);

  const finish = useCallback(async () => {
    if (finished.current) return;
    finished.current = true;
    await queue.current;
    await post(`finish?lang=${lang}`).catch(() => undefined);
  }, [post, lang]);

  const start = useCallback(async () => {
    if (!enabled || starting) return;
    setStarting(true);
    setError(null);
    try {
      const res = await fetch(`/api/calls/${callId}/live/session`);
      const json = (await res.json()) as SessionResponse;
      if (!json.ok || !json.data) throw new Error(json.error?.message ?? `session ${res.status}`);

      conversation.startSession({
        signedUrl: json.data.signed_url,
        dynamicVariables: json.data.dynamic_variables,
        clientTools: {
          request_user_approval: async (params: Record<string, unknown>) => {
            // Let the agent's "checking with them" line land before the card.
            await queue.current;
            const r = await post("approval", {
              summary: String(params.summary ?? ""),
              monthly_price: Number(params.monthly_price),
              lang,
            });
            const result = (await r.json().catch(() => null)) as { approved?: boolean; reason?: string } | null;
            return JSON.stringify({ approved: !!result?.approved, reason: result?.reason ?? "error" });
          },
        },
        onConnect: ({ conversationId }) => {
          void post("session", { conversation_id: conversationId });
        },
        onMessage: ({ message, role }) => {
          const text = message.trim();
          if (!text) return;
          void enqueue(() =>
            post("turn", { speaker: role === "agent" ? "agent" : "rep", text, lang }),
          );
        },
        onDisconnect: () => void finish(),
        onError: (message) => setError(String(message)),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStarting(false);
    }
  }, [enabled, starting, callId, conversation, post, enqueue, finish, lang]);

  const end = useCallback(async () => {
    conversation.endSession();
    await finish();
  }, [conversation, finish]);

  const endRef = useRef(conversation.endSession);
  endRef.current = conversation.endSession;
  useEffect(() => () => endRef.current(), []);

  return {
    start,
    end,
    error,
    connecting: starting || conversation.status === "connecting",
    connected: conversation.status === "connected",
    isSpeaking: conversation.isSpeaking,
  };
}
