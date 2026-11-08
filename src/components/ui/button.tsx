"use client";

import { forwardRef } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "outline" | "danger" | "success" | "paper";
export type ButtonSize = "sm" | "md" | "lg" | "icon" | "icon-sm";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white hover:bg-brand-hover shadow-[0_1px_0_0_rgb(255_255_255/0.12)_inset]",
  secondary: "bg-card text-fg hover:bg-card-hover border border-line",
  outline: "border border-line-strong text-fg hover:bg-white/5",
  ghost: "text-fg-muted hover:text-fg hover:bg-white/5",
  danger: "bg-danger/90 text-white hover:bg-danger",
  success: "bg-success text-[#052e16] hover:bg-success/90 font-semibold",
  paper: "bg-paper text-paper-ink hover:bg-white",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-11 sm:h-9 px-3 text-[13px] gap-1.5 rounded-[10px]",
  md: "h-11 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-5 text-[15px] gap-2 rounded-xl",
  icon: "h-11 w-11 rounded-xl",
  "icon-sm": "h-11 w-11 sm:h-9 sm:w-9 rounded-[10px]",
};

export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(
    "relative inline-flex select-none items-center justify-center whitespace-nowrap font-medium",
    "transition-[background-color,color,border-color,transform,opacity] duration-150 active:scale-[0.97]",
    "disabled:pointer-events-none disabled:opacity-45 cursor-pointer",
    variants[variant],
    sizes[size],
    className,
  );
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, disabled, className, children, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses(variant, size, className)}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

type ButtonLinkProps = React.ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize };

export function ButtonLink({ variant = "primary", size = "md", className, ...props }: ButtonLinkProps) {
  return <Link className={buttonClasses(variant, size, className)} {...props} />;
}
