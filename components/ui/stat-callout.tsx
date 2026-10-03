import type { ReactNode } from "react";
import { Caption } from "./caption";
import { cn } from "./cn";

// Mecha-style metric: a big numeral with a caption underneath.
export function StatCallout({
  value,
  label,
  tone = "default",
  className,
}: {
  value: ReactNode;
  label: ReactNode;
  tone?: "default" | "success";
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <p
        className={cn(
          "font-display text-5xl leading-none tabular-nums",
          tone === "success" && "text-success",
        )}
      >
        {value}
      </p>
      <Caption>{label}</Caption>
    </div>
  );
}
