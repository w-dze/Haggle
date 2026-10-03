import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

type Variant = "primary" | "outline" | "secondary" | "danger" | "ghost";
type Size = "md" | "lg";

type Common = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
};
type AsLink = Common & { href: string } & Omit<ComponentProps<typeof Link>, keyof Common | "href">;
type AsButton = Common & { href?: undefined } & Omit<ComponentProps<"button">, keyof Common>;

const VARIANTS: Record<Variant, string> = {
  primary: "border border-foreground bg-foreground text-background hover:bg-foreground/85",
  outline: "border border-foreground text-foreground hover:bg-foreground/5",
  secondary: "border border-line bg-surface text-foreground hover:bg-foreground/5",
  danger: "border border-accent text-accent hover:bg-accent/10",
  ghost: "text-muted hover:text-foreground",
};

// lg = 56px minimum tap target for the user path (NFR-3).
const SIZES: Record<Size, string> = {
  md: "min-h-11 px-5 text-sm font-medium",
  lg: "min-h-14 px-6 text-base font-semibold",
};

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-full transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground " +
  "disabled:pointer-events-none disabled:opacity-50";

/** Pill button; renders a Next.js <Link> when given `href`. */
export function Button(props: AsLink | AsButton) {
  if (props.href !== undefined) {
    const { variant = "primary", size = "md", className, children, ...rest } = props;
    return (
      <Link className={cn(BASE, VARIANTS[variant], SIZES[size], className)} {...rest}>
        {children}
      </Link>
    );
  }
  const { variant = "primary", size = "md", className, children, type = "button", ...rest } =
    props;
  return (
    <button type={type} className={cn(BASE, VARIANTS[variant], SIZES[size], className)} {...rest}>
      {children}
    </button>
  );
}
