import Link from "next/link";
import { CalendarClock, MapPin } from "lucide-react";
import { StatusBadge } from "@/components/ui/badge";
import { Money, Table, Td, Th, Tr } from "@/components/ui/misc";
import { MotionItem, MotionList } from "@/components/ui/motion-list";
import { InstallmentActions } from "@/features/collections/components/installment-actions";
import { INSTALLMENT_STATUS } from "@/lib/labels";
import { formatBRL, formatDate } from "@/lib/format";
import { num } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { InstallmentView } from "@/types/database";

export function installmentLabel(n: number) {
  return n === 0 ? "Entrada" : `Parcela ${n}`;
}

/** Data de cobrança, destacada quando adiada (diferente do vencimento original). */
function CollectionDate({ i, compact }: { i: InstallmentView; compact?: boolean }) {
  if (!i.is_postponed) return <span className="tabular">{formatDate(i.collection_date)}</span>;
  return (
    <span className="inline-flex items-center gap-1 font-medium text-info" title={`Adiada ${i.postponed_count}x — vencimento original ${formatDate(i.original_due_date)}`}>
      <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="tabular">{formatDate(i.collection_date)}</span>
      {!compact && i.postponed_count > 0 && <span className="text-[11px] text-info/80">({i.postponed_count}x)</span>}
    </span>
  );
}

/** Card de parcela (celular e visão geral). */
export function InstallmentCard({ i, showSale = true }: { i: InstallmentView; showSale?: boolean }) {
  const remaining = num(i.remaining);
  const paid = num(i.paid_amount);
  const pending = num(i.pending_confirmation_amount);
  return (
    <div className="rounded-xl border border-line bg-bg-elevated p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-fg">
            {installmentLabel(i.number)}
            {showSale && (
              <Link href={`/vendas/${i.sale_id}`} className="ml-1.5 text-[12.5px] font-medium text-fg-muted hover:text-bronze">
                · Venda #{i.sale_code}
              </Link>
            )}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-fg-muted">
            <span>Cobrança</span>
            <CollectionDate i={i} compact />
            {i.is_postponed && <span className="text-fg-subtle">· venc. {formatDate(i.original_due_date)}</span>}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <Money value={remaining > 0 ? remaining : i.amount} className="text-[15px] font-semibold text-fg" />
          <p className="text-[11px] text-fg-subtle">{remaining > 0 && paid > 0 ? `de ${formatBRL(i.amount)}` : remaining > 0 ? "a receber" : "valor"}</p>
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <StatusBadge status={i.status} map={INSTALLMENT_STATUS} />
        {i.days_overdue > 0 && <span className="text-[12px] font-medium text-danger-fg">{i.days_overdue} dias de atraso</span>}
        {pending > 0 && (
          <span className="text-[12px] text-warning">
            <Money value={pending} /> aguardando confirmação
          </span>
        )}
        {i.needs_visit && (
          <span className="inline-flex items-center gap-1 text-[12px] text-fg-muted">
            <MapPin className="h-3 w-3" aria-hidden /> visita
          </span>
        )}
      </div>
      {i.status !== "paid" && i.status !== "cancelled" && (
        <div className="mt-3 border-t border-line pt-3">
          <InstallmentActions installment={i} layout="compact" />
        </div>
      )}
    </div>
  );
}


export function InstallmentCardList({ items, showSale = true }: { items: InstallmentView[]; showSale?: boolean }) {
  return (
    <MotionList className="space-y-2">
      {items.map((i) => (
        <MotionItem key={i.id}>
          <InstallmentCard i={i} showSale={showSale} />
        </MotionItem>
      ))}
    </MotionList>
  );
}

/** Tabela de parcelas de UMA venda (desktop). */
export function InstallmentTable({ items }: { items: InstallmentView[] }) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>Nº</Th>
          <Th className="text-right">Valor</Th>
          <Th className="text-right">Pago</Th>
          <Th className="text-right">Restante</Th>
          <Th>Vencimento</Th>
          <Th>Cobrança</Th>
          <Th>Status</Th>
          <Th className="w-[1%]">
            <span className="sr-only">Ações</span>
          </Th>
        </tr>
      </thead>
      <tbody>
        {items.map((i) => {
          const remaining = num(i.remaining);
          const pending = num(i.pending_confirmation_amount);
          return (
            <Tr key={i.id} className={cn(i.status === "cancelled" && "opacity-60")}>
              <Td className="whitespace-nowrap font-medium">{i.number === 0 ? "Entrada" : i.number}</Td>
              <Td className="text-right">
                <Money value={i.amount} />
              </Td>
              <Td className="text-right text-fg-muted">
                <Money value={i.paid_amount} />
                {pending > 0 && (
                  <span className="block text-[11px] text-warning">
                    +<Money value={pending} /> pend.
                  </span>
                )}
              </Td>
              <Td className={cn("text-right font-medium", remaining > 0 ? "text-fg" : "text-fg-subtle")}>
                <Money value={remaining} />
              </Td>
              <Td className="tabular whitespace-nowrap text-fg-muted">{formatDate(i.original_due_date)}</Td>
              <Td className="whitespace-nowrap">
                <CollectionDate i={i} />
              </Td>
              <Td>
                <div className="flex flex-col items-start gap-1">
                  <StatusBadge status={i.status} map={INSTALLMENT_STATUS} />
                  {i.days_overdue > 0 && <span className="text-[11px] text-danger-fg">{i.days_overdue} dias</span>}
                </div>
              </Td>
              <Td>
                {i.status !== "paid" && i.status !== "cancelled" ? (
                  <div className="flex justify-end">
                    <InstallmentActions installment={i} layout="compact" />
                  </div>
                ) : (
                  <span className="block text-right text-[12px] text-fg-subtle">{i.paid_at ? `Paga em ${formatDate(i.paid_at)}` : "—"}</span>
                )}
              </Td>
            </Tr>
          );
        })}
      </tbody>
    </Table>
  );
}
