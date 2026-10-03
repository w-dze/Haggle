"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

// Tracked uppercase nav item, underlined while its page is open.
export function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const active = usePathname() === href;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-11 items-center text-[11px] font-medium uppercase tracking-[0.14em] underline-offset-[6px] hover:text-foreground",
        active ? "text-foreground underline" : "text-muted",
      )}
    >
      {children}
    </Link>
  );
}
