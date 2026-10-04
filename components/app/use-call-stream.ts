"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { StreamEvent } from "@/lib/bus";
import { enqueueCallLine, stopCallPlayback, waitForCallPlayback, type PlayLine } from "@/lib/call-playback";
import { runMockCall, type MockCallControls } from "@/lib/mock-call";

type Line = Extract<StreamEvent, { type: "line" }>;
type Approval = Extract<StreamEvent, { type: "approval" }>;
type Outcome = Extract<StreamEvent, { type: "outcome" }>;
export type CallStatus = Extract<StreamEvent, { type: "status" }>["status"];

export type FeedItem =
  | { kind: "line"; line: Line }
  | { kind: "notice"; id: string; notice: "approval_timeout" };

type State = {
  status: CallStatus;
  items: FeedItem[];
  approval: Approval | null;
  /** Approvals already answered, timed out or dismissed; ignored if replayed. */
  closedApprovals: string[];
  outcome: Outcome | null;
  connected: boolean;
  liveAt: number | null;
  endedAt: number | null;
};

type Action =
  | { kind: "event"; evt: StreamEvent; at: number }
  | { kind: "connection"; ok: boolean }
  | { kind: "approval_closed"; id: string; timedOut: boolean };

const TERMINAL: ReadonlySet<CallStatus> = new Set(["ended", "failed", "killed"]);
export const isTerminal = (status: CallStatus) => TERMINAL.has(status);

const initialState: State = {
  status: "dialing",
  items: [],
  approval: null,
  closedApprovals: [],
  outcome: null,
  connected: true,
  liveAt: null,
  endedAt: null,
};

function closeApproval(state: State, id: string, timedOut: boolean): State {
  if (state.closedApprovals.includes(id)) return state;
  return {
    ...state,
    approval: state.approval?.id === id ? null : state.approval,
    closedApprovals: [...state.closedApprovals, id],
    items: timedOut
      ? [...state.items, { kind: "notice", id, notice: "approval_timeout" }]
      : state.items,
  };
}

function reducer(state: State, action: Action): State {
  switch (action.kind) {
    case "connection":
      return { ...state, connected: action.ok };
    case "approval_closed":
      return closeApproval(state, action.id, action.timedOut);
    case "event": {
      const { evt, at } = action;
      switch (evt.type) {
        case "status":
          return {
            ...state,
            status: evt.status,
            connected: true,
            liveAt: evt.status === "live" && state.liveAt === null ? at : state.liveAt,
            endedAt: TERMINAL.has(evt.status) && state.endedAt === null ? at : state.endedAt,
          };
        case "line":
          // The real stream replays every line on reconnect; dedupe by seq.
          if (state.items.some((i) => i.kind === "line" && i.line.seq === evt.seq)) return state;
          return { ...state, items: [...state.items, { kind: "line", line: evt }] };
        case "approval":
          if (state.closedApprovals.includes(evt.id) || state.approval?.id === evt.id) return state;
          return { ...state, approval: evt };
        case "approval_resolved":
          return closeApproval(state, evt.id, evt.status === "timeout");
        case "outcome":
          return { ...state, outcome: evt };
        default:
          return state;
      }
    }
  }
}

export type CallMode = "mock" | "simulated" | "live";

/**
 * Live call state, fed either by the real SSE stream or, with `mock`, by the
 * scripted demo call. Both paths go through the same reducer. Subtitles appear
 * when Grok Voice starts the line (or immediately if TTS is unavailable).
 * In `live` mode the ElevenLabs agent is the voice, so lines show as they land.
 */
export function useCallStream(callId: string, lang: string, mode: CallMode) {
  const mock = mode === "mock";
  const live = mode === "live";
  const [state, dispatch] = useReducer(reducer, initialState);
  const mockRef = useRef<MockCallControls | null>(null);
  const [voiceReady, setVoiceReady] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const onLine = (evt: Line) => {
      enqueueCallLine(callId, evt as PlayLine, {
        onShow: (line) =>
          dispatch({ kind: "event", evt: { type: "line", ...line }, at: Date.now() }),
        onVoiceReady: () => setVoiceReady(true),
        onNeedsGesture: () => setNeedsGesture(true),
      });
    };
    const onEvent = (evt: StreamEvent) => {
      if (live) {
        dispatch({ kind: "event", evt, at: Date.now() });
        return;
      }
      if (evt.type === "line") {
        onLine(evt);
        return;
      }
      // Approve / outcome / ended must wait until the current line has been
      // spoken, otherwise the card pops in over the last offer.
      const wait =
        evt.type === "approval" ||
        evt.type === "outcome" ||
        (evt.type === "status" && TERMINAL.has(evt.status) && evt.status !== "killed");
      if (wait) {
        void waitForCallPlayback(callId).then(() => {
          if (!cancelled) dispatch({ kind: "event", evt, at: Date.now() });
        });
        return;
      }
      dispatch({ kind: "event", evt, at: Date.now() });
    };

    if (mock) {
      const controls = runMockCall(lang, onEvent);
      mockRef.current = controls;
      return () => {
        cancelled = true;
        controls.stop();
        stopCallPlayback(callId);
      };
    }

    if (!live) {
      fetch(`/api/calls/${callId}/simulate?lang=${lang}`, { method: "POST" }).catch(() => {
        /* playback is best-effort; SSE still shows persisted lines */
      });
    }

    const es = new EventSource(`/api/calls/${callId}/stream`);
    es.onopen = () => dispatch({ kind: "connection", ok: true });
    es.onmessage = (e) => {
      const evt = JSON.parse(e.data) as StreamEvent;
      onEvent(evt);
      // The server closes the stream after a terminal status; don't reconnect.
      if (evt.type === "status" && TERMINAL.has(evt.status)) es.close();
    };
    // EventSource retries on its own; just show that we're reconnecting.
    es.onerror = () => {
      if (es.readyState !== EventSource.CLOSED) dispatch({ kind: "connection", ok: false });
    };
    return () => {
      cancelled = true;
      es.close();
      stopCallPlayback(callId);
    };
  }, [callId, lang, mock, live]);

  // The countdown is the user's deadline. If it runs out unanswered, close the
  // card locally (the server treats no answer as "no").
  const pending = state.approval;
  useEffect(() => {
    if (!pending) return;
    const ms = Math.max(0, new Date(pending.expires_at).getTime() - Date.now());
    const timer = setTimeout(
      () => dispatch({ kind: "approval_closed", id: pending.id, timedOut: true }),
      ms,
    );
    return () => clearTimeout(timer);
  }, [pending]);

  const answer = useCallback(
    async (decision: "yes" | "no") => {
      if (!pending) return;
      if (mock) {
        mockRef.current?.answer(decision);
      } else {
        const res = await fetch(`/api/approvals/${pending.id}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ decision }),
        });
        if (!res.ok) throw new Error(`approval failed: ${res.status}`);
      }
      // Leave the "sent" confirmation up briefly, then return to the transcript.
      setTimeout(() => dispatch({ kind: "approval_closed", id: pending.id, timedOut: false }), 1500);
    },
    [mock, pending],
  );

  const end = useCallback(async () => {
    stopCallPlayback(callId);
    if (mock) mockRef.current?.end();
    else if (live) await fetch(`/api/calls/${callId}/live/finish?lang=${lang}`, { method: "POST" });
    else await fetch(`/api/calls/${callId}/end`, { method: "POST" });
  }, [mock, live, callId, lang]);

  const unmute = useCallback(() => setNeedsGesture(false), []);

  return { ...state, answer, end, voiceReady, needsGesture, unmute };
}
