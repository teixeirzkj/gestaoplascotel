import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/format";
import type { CashClosing } from "@/types/database";

/** Divergência da conferência: verde = bate, âmbar = sobra, vermelho = falta. Sempre com texto. */
export function DivergenceValue({ closing, className }: { closing: Pick<CashClosing, "divergence" | "counted_cash">; className?: string }) {
  if (closing.counted_cash === null) {
    return <span className={cn("text-[13px] text-fg-muted", className)}>Dinheiro não contado</span>;
  }
  const d = closing.divergence;
  return (
    <span
      className={cn(
        "money whitespace-nowrap font-semibold",
        d === 0 && "text-success",
        d > 0 && "text-warning",
        d < 0 && "text-danger-fg",
        className,
      )}
    >
      {d === 0 ? "Sem divergência" : `${d > 0 ? "Sobra " : "Falta "}${formatBRL(Math.abs(d))}`}
    </span>
  );
}
