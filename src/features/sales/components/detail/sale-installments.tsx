"use client";

import { ArrowRight, Clock, MapPinned } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { MotionItem, MotionList } from "@/components/ui/motion-list";
import { Money, Table, Td, Th, Tr } from "@/components/ui/misc";
import { formatBRL, formatDate } from "@/lib/format";
import { INSTALLMENT_STATUS } from "@/lib/labels";
import { num } from "@/lib/money";
import { cn } from "@/lib/utils";
import { InstallmentActions } from "@/features/collections/components/installment-actions";
import type { InstallmentView } from "@/types/database";

function label(i: InstallmentView, count: number) {
  return i.number === 0 ? "Entrada" : `Parcela ${i.number}${count ? `/${count}` : ""}`;
}

function DueInfo({ i }: { i: InstallmentView }) {
  if (!i.is_postponed) return <span className="tabular">{formatDate(i.collection_date)}</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className="tabular text-fg-subtle line-through">{formatDate(i.original_due_date)}</span>
      <ArrowRight className="h-3 w-3 text-fg-subtle" aria-hidden />
      <span className="tabular">{formatDate(i.collection_date)}</span>
      <span className="sr-only">(adiada)</span>
    </span>
  );
}

function Flags({ i }: { i: InstallmentView }) {
  const pending = num(i.pending_confirmation_amount);
  return (
    <>
      {pending > 0 && (
        <span className="inline-flex items-center gap-1 text-[12px] text-warning">
          <Clock className="h-3.5 w-3.5" aria-hidden /> {formatBRL(pending)} aguardando confirmação
        </span>
      )}
      {i.needs_visit && i.status !== "paid" && i.status !== "cancelled" && (
        <span className="inline-flex items-center gap-1 text-[12px] text-info">
          <MapPinned className="h-3.5 w-3.5" aria-hidden /> Cobrar em visita
        </span>
      )}
    </>
  );
}

export function SaleInstallments({ installments, count }: { installments: InstallmentView[]; count: number }) {
  if (installments.length === 0) {
    return (
      <Card>
        <EmptyState compact title="Sem parcelas" description="Esta venda não possui parcelas registradas." />
      </Card>
    );
  }

  return (
    <>
      {/* Celular */}
      <MotionList className="space-y-2 md:hidden">
        {installments.map((i) => {
          const closed = i.status === "paid" || i.status === "cancelled";
          return (
            <MotionItem key={i.id}>
              <div className={cn("rounded-2xl border border-line bg-card p-3.5 shadow-card", i.status === "overdue" && "border-danger/30", closed && "opacity-80")}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-fg">{label(i, count)}</span>
                  <StatusBadge status={i.status} map={INSTALLMENT_STATUS} />
                </div>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <div className="min-w-0 text-[12px] text-fg-muted">
                    <p>
                      Cobrar em <span className="text-fg"><DueInfo i={i} /></span>
                    </p>
                    {i.days_overdue > 0 && <p className="mt-0.5 font-medium text-danger-fg">{i.days_overdue} dias de atraso</p>}
                  </div>
                  <div className="shrink-0 text-right">
                    <Money value={i.amount} className="block text-[17px] font-semibold text-fg" />
                    {num(i.paid_amount) > 0 && i.status !== "paid" && (
                      <span className="text-[12px] text-fg-muted">
                        Restam <Money value={i.remaining} className="font-medium text-fg" />
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-1.5 flex flex-col gap-0.5">
                  <Flags i={i} />
                </div>
                {!closed && (
                  <div className="mt-3 border-t border-line pt-3">
                    <InstallmentActions installment={i} layout="compact" />
                  </div>
                )}
              </div>
            </MotionItem>
          );
        })}
      </MotionList>

      {/* Desktop */}
      <Card className="hidden overflow-hidden md:block">
        <Table>
          <thead>
            <tr>
              <Th>Parcela</Th>
              <Th>Cobrança</Th>
              <Th className="text-right">Valor</Th>
              <Th className="text-right">Pago</Th>
              <Th className="text-right">Restante</Th>
              <Th>Situação</Th>
              <Th className="text-right">Ações</Th>
            </tr>
          </thead>
          <tbody>
            {installments.map((i) => (
              <Tr key={i.id}>
                <Td className="whitespace-nowrap font-medium">{label(i, count)}</Td>
                <Td className="text-[13px]">
                  <DueInfo i={i} />
                  <div className="flex flex-col">
                    {i.days_overdue > 0 && <span className="text-[12px] font-medium text-danger-fg">{i.days_overdue} dias de atraso</span>}
                    <Flags i={i} />
                  </div>
                </Td>
                <Td className="text-right">
                  <Money value={i.amount} className="font-medium" />
                </Td>
                <Td className="text-right text-fg-muted">
                  <Money value={i.paid_amount} />
                </Td>
                <Td className="text-right">
                  <Money value={i.status === "cancelled" ? 0 : i.remaining} className="font-semibold" />
                </Td>
                <Td>
                  <StatusBadge status={i.status} map={INSTALLMENT_STATUS} />
                </Td>
                <Td className="py-2 text-right">
                  {i.status !== "paid" && i.status !== "cancelled" ? (
                    <div className="flex justify-end">
                      <InstallmentActions installment={i} layout="row" />
                    </div>
                  ) : (
                    <span className="text-[12px] text-fg-subtle">{i.paid_at ? `Paga em ${formatDate(i.paid_at)}` : "—"}</span>
                  )}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
