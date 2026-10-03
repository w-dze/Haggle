import type { ReactNode } from "react";
import { cn } from "./cn";

// Mecha-style uppercase tracked label, optionally numbered: "01 · YOUR BILL".
export function Caption({
  index,
  children,
  as: Tag = "p",
  className,
  id,
}: {
  index?: string;
  children: ReactNode;
  as?: "p" | "span" | "h2" | "h3" | "label";
  className?: string;
  id?: string;
}) {
  return (
    <Tag
      id={id}
      className={cn(
        "font-sans text-xs font-medium uppercase tracking-[0.14em] text-muted",
        className,
      )}
    >
      {index && (
        <>
          <span className="tabular-nums text-foreground">{index}</span>
          <span aria-hidden="true"> · </span>
        </>
      )}
      {children}
    </Tag>
  );
}
