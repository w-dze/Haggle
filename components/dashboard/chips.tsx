import { cn } from "@/components/ui/cn";

// Soft tinted pills. Text always says the level, so color is never the only cue.

const CONF_TONE = {
  high: "border-accent/40 bg-accent/10 text-accent",
  medium: "border-line bg-foreground/5 text-foreground",
  low: "border-line bg-transparent text-muted",
} as const;

export function ConfidenceChip({
  level,
  label,
  srLabel,
}: {
  level: keyof typeof CONF_TONE;
  label: string;
  srLabel: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-7 shrink-0 items-center rounded-full border px-2.5 text-[11px] font-medium uppercase tracking-[0.12em]",
        CONF_TONE[level],
      )}
    >
      <span className="sr-only">{srLabel}: </span>
      {label}
    </span>
  );
}

const STATUS_TONE = {
  normal: "border-line text-muted",
  changed: "border-accent/40 bg-accent/10 text-accent",
  new: "border-foreground/30 bg-agent text-foreground",
  resolved: "border-success/40 bg-success/10 text-success",
} as const;

export function StatusChip({ status, label }: { status: keyof typeof STATUS_TONE; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full border px-2 text-[10px] font-medium uppercase tracking-[0.12em]",
        STATUS_TONE[status],
      )}
    >
      {label}
    </span>
  );
}
