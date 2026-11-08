import { CalendarCheck2, HandCoins, Landmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";

/**
 * As três datas do sistema são independentes:
 * - Vencimento financeiro (installments.original_due_date) — compromisso original da parcela.
 * - Data de cobrança (installments.collection_date) — muda com adiamentos.
 * - Data de visita (visits.visit_date) — quando a equipe vai à cidade.
 */
export const DATE_KINDS = {
  due: { label: "Vencimento", long: "Vencimento financeiro", icon: Landmark, cls: "text-fg-muted" },
  collection: { label: "Cobrança", long: "Data de cobrança", icon: HandCoins, cls: "text-warning" },
  visit: { label: "Visita", long: "Data de visita", icon: CalendarCheck2, cls: "text-bronze" },
} as const;

export type DateKind = keyof typeof DATE_KINDS;

/** Legenda explicando a separação das datas. */
export function DateSemanticsLegend({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-fg-muted", className)}>
      {(Object.keys(DATE_KINDS) as DateKind[]).map((k) => {
        const d = DATE_KINDS[k];
        const Icon = d.icon;
        return (
          <span key={k} className="inline-flex items-center gap-1.5">
            <Icon className={cn("h-3.5 w-3.5", d.cls)} aria-hidden />
            {d.long}
          </span>
        );
      })}
      <span className="text-fg-subtle">— são datas independentes.</span>
    </div>
  );
}

/** Data rotulada pelo tipo (ícone + rótulo + valor). */
export function TypedDate({ kind, date, className }: { kind: DateKind; date: string | null | undefined; className?: string }) {
  const d = DATE_KINDS[kind];
  const Icon = d.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[12px]", className)} title={d.long}>
      <Icon className={cn("h-3.5 w-3.5 shrink-0", d.cls)} aria-hidden />
      <span className="text-fg-subtle">{d.label}</span>
      <span className="tabular font-medium text-fg">{formatDate(date)}</span>
    </span>
  );
}
