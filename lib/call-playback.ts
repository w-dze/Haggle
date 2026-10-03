export type PlayLine = {
  seq: number;
  speaker: "agent" | "rep";
  en: string;
  tr: string;
  numbers_ok: boolean;
};

type Handlers = {
  onShow: (line: PlayLine) => void;
  onVoiceReady?: () => void;
  onNeedsGesture?: () => void;
};

const spoken = new Map<string, Set<number>>();
const inflight = new Map<string, Set<number>>();
const queues = new Map<string, Promise<void>>();
const audioByCall = new Map<string, HTMLAudioElement>();
const shown = new Map<string, Set<number>>();

function spokenKey(callId: string) {
  return `haggle-spoken-${callId}`;
}

function loadSpoken(callId: string): Set<number> {
  const existing = spoken.get(callId);
  if (existing) return existing;
  const set = new Set<number>();
  try {
    const raw = sessionStorage.getItem(spokenKey(callId));
    if (raw) for (const n of JSON.parse(raw) as number[]) set.add(n);
  } catch {
    /* ignore */
  }
  spoken.set(callId, set);
  return set;
}

function persistSpoken(callId: string, set: Set<number>) {
  try {
    sessionStorage.setItem(spokenKey(callId), JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
}

function shownSet(callId: string): Set<number> {
  let set = shown.get(callId);
  if (!set) {
    set = new Set();
    shown.set(callId, set);
  }
  return set;
}

function inflightSet(callId: string): Set<number> {
  let set = inflight.get(callId);
  if (!set) {
    set = new Set();
    inflight.set(callId, set);
  }
  return set;
}

export function alreadyShown(callId: string, seq: number): boolean {
  return shownSet(callId).has(seq);
}

export function enqueueCallLine(callId: string, line: PlayLine, handlers: Handlers): void {
  const done = loadSpoken(callId);
  const visible = shownSet(callId);

  if (visible.has(line.seq) || inflightSet(callId).has(line.seq)) return;

  if (done.has(line.seq)) {
    visible.add(line.seq);
    handlers.onShow(line);
    return;
  }

  inflightSet(callId).add(line.seq);
  const prev = queues.get(callId) ?? Promise.resolve();
  const next = prev.then(async () => {
    if (visible.has(line.seq)) {
      inflightSet(callId).delete(line.seq);
      return;
    }

    let url: string | null = null;
    try {
      const res = await fetch("/api/voice/tts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: line.en, speaker: line.speaker, language: "en" }),
      });
      if (res.ok) {
        const blob = await res.blob();
        url = URL.createObjectURL(blob);
      }
    } catch {
      /* fall through and still show the subtitle */
    }

    visible.add(line.seq);
    done.add(line.seq);
    persistSpoken(callId, done);
    inflightSet(callId).delete(line.seq);
    handlers.onShow(line);

    if (!url) return;
    const audio = new Audio(url);
    audioByCall.get(callId)?.pause();
    audioByCall.set(callId, audio);
    await new Promise<void>((resolve) => {
      audio.onended = () => resolve();
      audio.onerror = () => resolve();
      audio.play().then(() => handlers.onVoiceReady?.()).catch(() => {
        handlers.onNeedsGesture?.();
        resolve();
      });
    });
    URL.revokeObjectURL(url);
    if (audioByCall.get(callId) === audio) audioByCall.delete(callId);
  });
  queues.set(callId, next.catch(() => undefined));
}

export function waitForCallPlayback(callId: string, ms = 20_000): Promise<void> {
  return Promise.race([
    queues.get(callId) ?? Promise.resolve(),
    new Promise<void>((r) => setTimeout(r, ms)),
  ]);
}

export function stopCallPlayback(callId: string): void {
  audioByCall.get(callId)?.pause();
  audioByCall.delete(callId);
}
