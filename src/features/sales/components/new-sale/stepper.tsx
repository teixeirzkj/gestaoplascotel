"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

export const STEPS = ["Cliente", "Produtos", "Pagamento", "Revisão"] as const;

/** Indicador de etapas (celular). Etapas anteriores são clicáveis para voltar. */
export function Stepper({ step, maxReached, onGo }: { step: number; maxReached: number; onGo: (s: number) => void }) {
  return (
    <nav aria-label="Etapas da venda" className="relative mb-5">
      <div className="absolute left-[12.5%] right-[12.5%] top-[17px] h-[2px] rounded-full bg-line-strong" aria-hidden>
        <motion.div
          className="h-full origin-left rounded-full bg-bronze"
          initial={false}
          animate={{ scaleX: (step - 1) / (STEPS.length - 1) }}
          transition={spring}
        />
      </div>
      <ol className="relative grid grid-cols-4">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const done = n < step;
          const current = n === step;
          const reachable = n <= maxReached && n !== step;
          return (
            <li key={label} className="relative flex flex-col items-center">
              <button
                type="button"
                disabled={!reachable}
                onClick={() => onGo(n)}
                aria-current={current ? "step" : undefined}
                aria-label={`Etapa ${n}: ${label}${done ? " (concluída)" : ""}`}
                className="flex min-h-11 min-w-11 cursor-pointer flex-col items-center gap-1.5 disabled:cursor-default"
              >
                <motion.span
                  initial={false}
                  animate={{ scale: current ? 1.08 : 1 }}
                  transition={spring}
                  className={cn(
                    "relative z-10 flex h-9 w-9 items-center justify-center rounded-full border text-[13px] font-semibold transition-colors",
                    current && "border-bronze bg-brand text-white shadow-[0_0_0_4px_rgb(168_135_98/0.18)]",
                    done && "border-bronze/60 bg-bronze-soft text-bronze",
                    !current && !done && "border-line-strong bg-bg-elevated text-fg-subtle",
                  )}
                >
                  {done ? <Check className="h-4 w-4" aria-hidden /> : n}
                </motion.span>
                <span className={cn("text-[11.5px] font-medium", current ? "text-fg" : "text-fg-muted")}>{label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
