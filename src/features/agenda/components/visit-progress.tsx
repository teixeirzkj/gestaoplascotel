"use client";

import { motion } from "framer-motion";
import { springSoft } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** Barra de progresso de atendimento (anima apenas transform: scaleX). */
export function VisitProgress({
  attended,
  total,
  className,
  showLabel = true,
  size = "md",
}: {
  attended: number;
  total: number;
  className?: string;
  showLabel?: boolean;
  size?: "sm" | "md";
}) {
  const ratio = total > 0 ? Math.min(1, attended / total) : 0;
  const complete = total > 0 && attended >= total;
  return (
    <div className={cn("min-w-0", className)}>
      {showLabel && (
        <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[12px]">
          <span className="text-fg-muted">
            <span className="tabular font-semibold text-fg">{attended}</span> de <span className="tabular">{total}</span>{" "}
            {total === 1 ? "cliente atendido" : "clientes atendidos"}
          </span>
          <span className={cn("tabular font-medium", complete ? "text-success" : "text-fg-subtle")}>{Math.round(ratio * 100)}%</span>
        </div>
      )}
      <div
        className={cn("overflow-hidden rounded-full bg-white/[0.07]", size === "sm" ? "h-1.5" : "h-2")}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={attended}
        aria-label="Progresso de atendimento"
      >
        <motion.div
          className={cn("h-full w-full origin-left rounded-full", complete ? "bg-success" : "bg-bronze")}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: ratio }}
          transition={springSoft}
        />
      </div>
    </div>
  );
}
