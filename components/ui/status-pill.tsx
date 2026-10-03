import type { StreamEvent } from "@/lib/bus";
import { cn } from "./cn";

export type CallStatus = Extract<StreamEvent, { type: "status" }>["status"];

// Call status chip: grey dot while dialing, green dot with a halo while live,
// a green check once ended, maroon dot if the call failed or was cut off.
export function StatusPill({ status, label }: { status: CallStatus; label: string }) {
  return (
    <span
      role="status"
      className="inline-flex h-8 items-center gap-2 rounded-full border border-line bg-surface px-3"
    >
      {status === "ended" ? (
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-success"
          aria-hidden="true"
        >
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      ) : (
        <span
          aria-hidden="true"
          className={cn(
            "size-2 rounded-full",
            status === "live" && "bg-success ring-4 ring-success/20",
            status === "dialing" && "bg-muted",
            (status === "failed" || status === "killed") && "bg-accent",
          )}
        />
      )}
      <span className="text-[11px] font-medium uppercase tracking-[0.14em]">{label}</span>
    </span>
  );
}
