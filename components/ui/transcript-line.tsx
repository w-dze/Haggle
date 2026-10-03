import type { StreamEvent } from "@/lib/bus";
import { cn } from "./cn";

type Line = Extract<StreamEvent, { type: "line" }>;

// One subtitle bubble: translation large, English small underneath (§5.8).
// Haggle's lines sit left on the sky tint; the rep's sit right on white.
export function TranscriptLine({
  line,
  lang,
  showEnglish,
  past = false,
  labels,
}: {
  line: Line;
  lang: string;
  showEnglish: boolean;
  /** Older lines are muted so the newest one stands out. */
  past?: boolean;
  labels: { agent: string; rep: string; numberCheck: string };
}) {
  const isAgent = line.speaker === "agent";
  return (
    <div
      className={cn(
        "max-w-[86%] rounded-[18px] px-3.5 py-3 transition-opacity",
        isAgent
          ? "self-start rounded-bl-[4px] bg-agent"
          : "self-end rounded-br-[4px] border border-line bg-surface",
        past && "opacity-70",
      )}
    >
      <p
        className={cn(
          "mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]",
          !isAgent && "text-muted",
        )}
      >
        {isAgent ? labels.agent : labels.rep}
      </p>
      <p lang={lang} className="text-xl leading-[1.25] font-medium">
        {line.tr}
      </p>
      {showEnglish && (
        <p lang="en" className="mt-1 text-[13px] leading-[1.35] text-muted">
          {line.en}
        </p>
      )}
      {!line.numbers_ok && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-accent">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5M12 16.5v.01" />
          </svg>
          {labels.numberCheck}
        </p>
      )}
    </div>
  );
}
