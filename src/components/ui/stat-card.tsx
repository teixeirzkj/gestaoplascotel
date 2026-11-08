"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { listItem } from "@/lib/motion";

/**
 * Indicador compacto. Projetado para grade 2x2 no celular (≈ 96px de altura).
 * tone "paper" = superfície clara de destaque.
 */
export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
  href,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "default" | "paper" | "danger" | "success" | "warning";
  href?: string;
  className?: string;
}) {
  const toneCls = {
    default: "bg-card border-line text-fg",
    paper: "bg-paper border-transparent text-paper-ink",
    danger: "bg-card border-danger/25 text-fg",
    success: "bg-card border-success/20 text-fg",
    warning: "bg-card border-warning/25 text-fg",
  }[tone];
  const iconCls = {
    default: "bg-bronze-soft text-bronze",
    paper: "bg-brand/15 text-brand",
    danger: "bg-danger-soft text-danger-fg",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
  }[tone];

  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className={cn("text-[12px] font-medium leading-tight sm:text-[13px]", tone === "paper" ? "text-paper-muted" : "text-fg-muted")}>
          {label}
        </span>
        {icon && <span className={cn("hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg xs:flex", iconCls)}>{icon}</span>}
      </div>
      <div className="money mt-2 whitespace-nowrap text-[clamp(15px,4.6vw,19px)] font-semibold leading-none tracking-tight xs:text-[21px] sm:text-[26px]">{value}</div>
      {hint && (
        <div className={cn("mt-1.5 line-clamp-2 break-words text-[11.5px] leading-snug sm:text-[12px]", tone === "paper" ? "text-paper-muted" : "text-fg-subtle")}>{hint}</div>
      )}
    </>
  );

  const cls = cn("block h-full min-w-0 rounded-2xl border p-3.5 shadow-card sm:p-4", toneCls, href && "transition-transform active:scale-[0.98]");

  // className vai no item da grade (ex.: col-span-2), não no card interno.
  return (
    <motion.div variants={listItem} className={cn("min-w-0", className)}>
      {href ? (
        <Link href={href} className={cls}>
          {content}
        </Link>
      ) : (
        <div className={cls}>{content}</div>
      )}
    </motion.div>
  );
}
