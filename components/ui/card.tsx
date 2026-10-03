import type { ReactNode } from "react";
import { cn } from "./cn";

// Surface panel with a hairline border.
export function Card({
  as: Tag = "div",
  className,
  children,
}: {
  as?: "div" | "article" | "section";
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tag className={cn("rounded-2xl border border-line bg-surface p-4", className)}>
      {children}
    </Tag>
  );
}
