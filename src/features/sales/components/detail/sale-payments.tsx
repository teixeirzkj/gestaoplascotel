"use client";

import { Paperclip } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { MotionItem, MotionList } from "@/components/ui/motion-list";
import { Money, Table, Td, Th, Tr } from "@/components/ui/misc";
import { formatDate, formatDateTime } from "@/lib/format";
import { PAYMENT_STATUS, methodLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { PaymentStatusActions } from "@/features/collections/components/payment-status-actions";
import type { PaymentView } from "@/types/database";

function ref(p: PaymentView) {
  return p.installment_number === 0 ? "Entrada" : `Parcela ${p.installment_number}`;
}

export function SalePayments({ payments }: { payments: PaymentView[] }) {
  if (payments.length === 0) {
    return (
      <Card>
        <EmptyState compact title="Nenhum pagamento registrado" description="Os recebimentos desta venda aparecerão aqui. Use “Receber” em uma parcela." />
      </Card>
    );
  }

  return (
    <>
      <MotionList className="space-y-2 md:hidden">
        {payments.map((p) => {
          const inactive = p.status === "rejected" || p.status === "reversed";
          return (
            <MotionItem key={p.id}>
              <div className={cn("rounded-2xl border border-line bg-card p-3.5 shadow-card", inactive && "opacity-75")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Money value={p.amount} className={cn("block text-[17px] font-semibold text-fg", inactive && "line-through")} />
                    <p className="mt-0.5 text-[12px] text-fg-muted">
                      <span className="tabular">{formatDate(p.paid_on)}</span> · {methodLabel(p.method)} · {ref(p)}
                    </p>
                  </div>
                  <StatusBadge status={p.status} map={PAYMENT_STATUS} />
                </div>
                <p className="mt-1.5 text-[12px] text-fg-subtle">
                  Registrado por {p.created_by_name ?? "—"} em {formatDateTime(p.created_at)}
                  {p.receipts_count > 0 && (
                    <span className="ml-1.5 inline-flex items-center gap-0.5 text-fg-muted">
                      <Paperclip className="h-3 w-3" aria-hidden /> {p.receipts_count}
                    </span>
                  )}
                </p>
                {(p.notes || p.status_reason) && (
                  <p className="mt-1 text-[12px] text-fg-muted">{p.status_reason ? `Motivo: ${p.status_reason}` : p.notes}</p>
                )}
                <div className="mt-3 border-t border-line pt-3">
                  <PaymentStatusActions payment={p} />
                </div>
              </div>
            </MotionItem>
          );
        })}
      </MotionList>

      <Card className="hidden overflow-hidden md:block">
        <Table>
          <thead>
            <tr>
              <Th>Data</Th>
              <Th>Referência</Th>
              <Th>Forma</Th>
              <Th className="text-right">Valor</Th>
              <Th>Situação</Th>
              <Th className="hidden lg:table-cell">Registrado por</Th>
              <Th className="text-right">Ações</Th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => {
              const inactive = p.status === "rejected" || p.status === "reversed";
              return (
                <Tr key={p.id}>
                  <Td className="tabular whitespace-nowrap">{formatDate(p.paid_on)}</Td>
                  <Td className="text-fg-muted">
                    {ref(p)}
                    {p.receipts_count > 0 && (
                      <span className="ml-2 inline-flex items-center gap-0.5 text-[12px]" aria-label={`${p.receipts_count} comprovante(s)`}>
                        <Paperclip className="h-3 w-3" aria-hidden /> {p.receipts_count}
                      </span>
                    )}
                    {p.status_reason && <span className="block max-w-[240px] truncate text-[12px] text-fg-subtle">Motivo: {p.status_reason}</span>}
                  </Td>
                  <Td className="text-fg-muted">{methodLabel(p.method)}</Td>
                  <Td className="text-right">
                    <Money value={p.amount} className={cn("font-semibold", inactive && "text-fg-muted line-through")} />
                  </Td>
                  <Td>
                    <StatusBadge status={p.status} map={PAYMENT_STATUS} />
                  </Td>
                  <Td className="hidden text-[13px] text-fg-muted lg:table-cell">
                    {p.created_by_name ?? "—"}
                    <span className="block text-[12px] text-fg-subtle">{formatDateTime(p.created_at)}</span>
                  </Td>
                  <Td className="py-2 text-right">
                    <div className="flex justify-end">
                      <PaymentStatusActions payment={p} />
                    </div>
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
