import Link from "next/link";
import { ArrowRight, CalendarClock, ChevronRight, CircleDollarSign, Handshake, Receipt } from "lucide-react";
import { StatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Money, Table, Td, Th, Tr } from "@/components/ui/misc";
import { MotionItem, MotionList } from "@/components/ui/motion-list";
import { SectionTitle } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { PaymentStatusActions } from "@/features/collections/components/payment-status-actions";
import { PAYMENT_STATUS, SALE_STATUS, methodLabel } from "@/lib/labels";
import { formatDate, formatDateTime } from "@/lib/format";
import { num } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { InstallmentView, PaymentView, PromiseView, SaleView } from "@/types/database";
import type { PostponementItem } from "../types";
import { InstallmentCardList, InstallmentTable, installmentLabel } from "./installment-items";
import { PromiseList } from "./promise-items";

type SaleGroup = { saleId: string; sale: SaleView | null; code: number; items: InstallmentView[] };

function groupBySale(installments: InstallmentView[], sales: SaleView[]): SaleGroup[] {
  const byId = new Map(sales.map((s) => [s.id, s]));
  const groups = new Map<string, SaleGroup>();
  for (const i of installments) {
    let g = groups.get(i.sale_id);
    if (!g) {
      g = { saleId: i.sale_id, sale: byId.get(i.sale_id) ?? null, code: i.sale_code, items: [] };
      groups.set(i.sale_id, g);
    }
    g.items.push(i);
  }
  for (const g of groups.values()) g.items.sort((a, b) => a.number - b.number);
  // Vendas em aberto primeiro; depois as mais recentes
  const rank = (g: SaleGroup) => (g.sale?.status === "open" ? 0 : g.sale?.status === "paid" ? 1 : 2);
  return [...groups.values()].sort((a, b) => rank(a) - rank(b) || b.code - a.code);
}

function SaleBlock({ g }: { g: SaleGroup }) {
  const s = g.sale;
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-line px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <Link href={`/vendas/${g.saleId}`} className="group inline-flex items-center gap-1 text-[15px] font-semibold text-fg hover:text-bronze">
            Venda #{g.code}
            <ChevronRight className="h-4 w-4 text-fg-subtle group-hover:text-bronze" aria-hidden />
          </Link>
          {s && <span className="tabular text-[12.5px] text-fg-muted">{formatDate(s.sale_date)}</span>}
          {s && <StatusBadge status={s.status} map={SALE_STATUS} />}
        </div>
        {s && (
          <dl className="grid grid-cols-3 gap-3 text-[12px] sm:flex sm:gap-5">
            <div>
              <dt className="text-fg-subtle">Total</dt>
              <dd>
                <Money value={s.total} className="font-medium text-fg" />
              </dd>
            </div>
            <div>
              <dt className="text-fg-subtle">Pago</dt>
              <dd>
                <Money value={s.paid_total} className="font-medium text-fg" />
              </dd>
            </div>
            <div className="text-right sm:text-left">
              <dt className="text-fg-subtle">Saldo</dt>
              <dd>
                <Money value={s.balance} className={cn("font-semibold", num(s.balance) > 0 ? "text-fg" : "text-fg-subtle")} />
              </dd>
            </div>
          </dl>
        )}
      </div>
      <div className="p-3 md:hidden">
        <InstallmentCardList items={g.items} showSale={false} />
      </div>
      <div className="hidden md:block">
        <InstallmentTable items={g.items} />
      </div>
    </Card>
  );
}

function PaymentsSection({ payments }: { payments: PaymentView[] }) {
  if (payments.length === 0) {
    return (
      <Card>
        <EmptyState compact icon={<CircleDollarSign className="h-5 w-5" />} title="Nenhum pagamento registrado" description="Use “Receber” em uma parcela para registrar um pagamento." />
      </Card>
    );
  }
  return (
    <>
      <MotionList as="ul" className="space-y-2 md:hidden">
        {payments.map((p) => (
          <MotionItem as="li" key={p.id} className="rounded-2xl border border-line bg-card p-3.5 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Money value={p.amount} className="text-[15px] font-semibold text-fg" />
                <p className="mt-0.5 text-[12.5px] text-fg-muted">
                  {methodLabel(p.method)} · <span className="tabular">{formatDate(p.paid_on)}</span>
                </p>
              </div>
              <StatusBadge status={p.status} map={PAYMENT_STATUS} />
            </div>
            <p className="mt-2 text-[12px] text-fg-subtle">
              Venda #{p.sale_code} · {installmentLabel(p.installment_number)}
              {p.created_by_name ? ` · por ${p.created_by_name}` : ""}
              {p.receipts_count > 0 ? ` · ${p.receipts_count} comprovante${p.receipts_count > 1 ? "s" : ""}` : ""}
            </p>
            {p.status_reason && <p className="mt-1 text-[12px] text-fg-muted">Motivo: {p.status_reason}</p>}
            <div className="mt-3 border-t border-line pt-3">
              <PaymentStatusActions payment={p} />
            </div>
          </MotionItem>
        ))}
      </MotionList>
      <Card className="hidden overflow-hidden md:block">
        <Table>
          <thead>
            <tr>
              <Th>Data</Th>
              <Th className="text-right">Valor</Th>
              <Th>Forma</Th>
              <Th>Referente a</Th>
              <Th>Registrado por</Th>
              <Th>Status</Th>
              <Th className="w-[1%]">
                <span className="sr-only">Ações</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <Tr key={p.id}>
                <Td className="tabular whitespace-nowrap">{formatDate(p.paid_on)}</Td>
                <Td className="text-right font-medium">
                  <Money value={p.amount} />
                </Td>
                <Td className="text-fg-muted">{methodLabel(p.method)}</Td>
                <Td className="whitespace-nowrap text-fg-muted">
                  #{p.sale_code} · {installmentLabel(p.installment_number)}
                </Td>
                <Td className="text-fg-muted">
                  <span className="block max-w-[180px] truncate">{p.created_by_name ?? "—"}</span>
                  <span className="tabular block text-[11px] text-fg-subtle">{formatDateTime(p.created_at)}</span>
                </Td>
                <Td>
                  <StatusBadge status={p.status} map={PAYMENT_STATUS} />
                  {p.status_reason && <span className="mt-1 block max-w-[200px] truncate text-[11px] text-fg-subtle" title={p.status_reason}>{p.status_reason}</span>}
                </Td>
                <Td>
                  <div className="flex justify-end">
                    <PaymentStatusActions payment={p} />
                  </div>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}

function PostponementsSection({ items, labels }: { items: PostponementItem[]; labels: Map<string, string> }) {
  if (items.length === 0) {
    return (
      <Card>
        <EmptyState compact icon={<CalendarClock className="h-5 w-5" />} title="Nenhum adiamento" description="Adiamentos de cobrança ficam registrados aqui com motivo e responsável." />
      </Card>
    );
  }
  return (
    <Card>
      <MotionList as="ul" className="divide-y divide-line">
        {items.map((a) => (
          <MotionItem as="li" key={a.id} className="flex gap-3 px-4 py-3.5 sm:px-5">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-info-soft text-info">
              <CalendarClock className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-1.5 text-[14px] font-medium text-fg">
                <span className="tabular text-fg-muted line-through decoration-fg-subtle/60">{formatDate(a.previous_date)}</span>
                <ArrowRight className="h-3.5 w-3.5 text-fg-subtle" aria-label="para" />
                <span className="tabular text-info">{formatDate(a.new_date)}</span>
                {labels.get(a.installment_id) && <span className="text-[12.5px] font-normal text-fg-muted">· {labels.get(a.installment_id)}</span>}
              </p>
              <p className="mt-1 break-words text-[13px] text-fg">{a.reason}</p>
              {(a.expected_channel || a.needs_visit) && (
                <p className="mt-1 flex flex-wrap gap-x-1.5 text-[12px] text-fg-muted">
                  {a.expected_channel && <span>Pagamento via {methodLabel(a.expected_channel)}</span>}
                  {a.expected_channel && a.needs_visit && <span aria-hidden>·</span>}
                  {a.needs_visit && <span>{a.expected_channel ? "visita presencial" : "Visita presencial"}</span>}
                </p>
              )}
              {a.notes && <p className="mt-0.5 break-words text-[12.5px] text-fg-muted">{a.notes}</p>}
              <p className="mt-1 text-[11.5px] text-fg-subtle">
                {a.author_name ?? "—"} · <span className="tabular">{formatDateTime(a.created_at)}</span>
              </p>
            </div>
          </MotionItem>
        ))}
      </MotionList>
    </Card>
  );
}

export function FinancialTab({
  installments,
  sales,
  payments,
  postponements,
  promises,
}: {
  installments: InstallmentView[];
  sales: SaleView[];
  payments: PaymentView[];
  postponements: PostponementItem[];
  promises: PromiseView[];
}) {
  const groups = groupBySale(installments, sales);
  const labels = new Map(installments.map((i) => [i.id, `${installmentLabel(i.number)} · venda #${i.sale_code}`]));

  return (
    <div className="space-y-7">
      <section>
        <SectionTitle>Parcelas por venda</SectionTitle>
        {groups.length === 0 ? (
          <Card>
            <EmptyState compact icon={<Receipt className="h-5 w-5" />} title="Nenhuma parcela" description="As parcelas são geradas ao registrar uma venda." />
          </Card>
        ) : (
          <MotionList className="space-y-3">
            {groups.map((g) => (
              <MotionItem key={g.saleId}>
                <SaleBlock g={g} />
              </MotionItem>
            ))}
          </MotionList>
        )}
      </section>

      <section>
        <SectionTitle>Pagamentos</SectionTitle>
        <PaymentsSection payments={payments} />
      </section>

      <section>
        <SectionTitle>Adiamentos</SectionTitle>
        <PostponementsSection items={postponements} labels={labels} />
      </section>

      <section>
        <SectionTitle>Promessas</SectionTitle>
        {promises.length === 0 ? (
          <Card>
            <EmptyState compact icon={<Handshake className="h-5 w-5" />} title="Nenhuma promessa registrada" />
          </Card>
        ) : (
          <PromiseList items={promises} labels={labels} />
        )}
      </section>
    </div>
  );
}
