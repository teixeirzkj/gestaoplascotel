import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Ban, BadgeCheck, CalendarDays, ChevronRight, CreditCard, MapPin, UserRound } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { formatBRL, formatDate, formatDateTime } from "@/lib/format";
import { SALE_STATUS, methodLabel } from "@/lib/labels";
import { num } from "@/lib/money";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, DataRow } from "@/components/ui/card";
import { Avatar, Money, Table, Td, Th, Tr } from "@/components/ui/misc";
import { FadeIn } from "@/components/ui/motion-list";
import { PageHeader, SectionTitle } from "@/components/ui/page-header";
import { getSaleDetail } from "@/features/sales/queries";
import { CancelSaleButton } from "@/features/sales/components/detail/cancel-sale-button";
import { SaleInstallments } from "@/features/sales/components/detail/sale-installments";
import { SalePayments } from "@/features/sales/components/detail/sale-payments";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  if (!UUID_RE.test(id)) return { title: "Venda" };
  const detail = await getSaleDetail(id);
  return { title: detail ? `Venda #${detail.sale.code}` : "Venda" };
}

function qty(n: number) {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

export default async function SaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const detail = await getSaleDetail(id);
  if (!detail) notFound();

  const { sale, items, installments, payments, createdByName, cancelledByName } = detail;
  const cancelled = sale.status === "cancelled";
  const paid = sale.status === "paid";
  const total = num(sale.total);
  const paidTotal = num(sale.paid_total);
  const progress = total > 0 ? Math.min(1, paidTotal / total) : 0;
  const activePayments = payments.filter((p) => p.status === "confirmed" || p.status === "pending_confirmation").length;
  const itemsSubtotal = items.reduce((acc, it) => acc + Math.round(num(it.total) * 100), 0) / 100;

  return (
    <>
      <PageHeader
        back={{ href: "/vendas", label: "Vendas" }}
        title={
          <span className="flex flex-wrap items-center gap-2.5">
            <span>
              Venda <span className="tabular text-bronze">#{sale.code}</span>
            </span>
            <StatusBadge status={sale.status} map={SALE_STATUS} />
          </span>
        }
        description={`Registrada em ${formatDateTime(sale.created_at)}${createdByName ? ` por ${createdByName}` : ""}`}
        actions={!cancelled && <CancelSaleButton saleId={sale.id} code={sale.code} activePayments={activePayments} />}
      />

      {cancelled && (
        <FadeIn className="mb-5">
          <div role="status" className="flex items-start gap-3 rounded-2xl border border-line-strong bg-white/[0.03] p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-fg-muted" aria-hidden>
              <Ban className="h-4 w-4" />
            </span>
            <div className="min-w-0 text-sm">
              <p className="font-semibold text-fg">Venda cancelada</p>
              <p className="mt-0.5 text-fg-muted">
                {sale.cancelled_at ? `Em ${formatDateTime(sale.cancelled_at)}` : ""}
                {cancelledByName ? ` por ${cancelledByName}` : ""}
                {sale.cancel_reason ? ` — ${sale.cancel_reason}` : ""}
              </p>
            </div>
          </div>
        </FadeIn>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="min-w-0 space-y-5">
          {/* Cliente e dados gerais */}
          <FadeIn>
            <Card>
              <Link
                href={`/clientes/${sale.customer_id}`}
                className="flex items-center gap-3 rounded-t-2xl px-4 py-4 transition-colors hover:bg-white/[0.025] sm:px-5"
              >
                <Avatar name={sale.customer_name} className="h-11 w-11" />
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] text-fg-muted">Cliente</p>
                  <p className="truncate text-[16px] font-semibold text-fg">{sale.customer_name}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-fg-subtle" aria-hidden />
              </Link>
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-b-2xl border-t border-line bg-line sm:grid-cols-3">
                <Info icon={<CalendarDays className="h-4 w-4" />} label="Data da venda" value={formatDate(sale.sale_date)} />
                <Info icon={<MapPin className="h-4 w-4" />} label="Cidade" value={sale.city_name ?? "—"} />
                <Info
                  icon={<CreditCard className="h-4 w-4" />}
                  label="Forma de pagamento"
                  value={sale.payment_method ? methodLabel(sale.payment_method) : "Não informada"}
                  className="col-span-2 sm:col-span-1"
                />
                <Info
                  icon={<UserRound className="h-4 w-4" />}
                  label="Registrada por"
                  value={createdByName ?? "—"}
                  className="col-span-2 sm:col-span-3"
                />
              </div>
            </Card>
          </FadeIn>

          {/* Itens */}
          <FadeIn delay={0.04}>
            <SectionTitle>Itens ({items.length})</SectionTitle>
            <Card className="md:hidden">
              <ul className="divide-y divide-line">
                {items.map((it) => (
                  <li key={it.id} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-fg">{it.description}</p>
                      <p className="tabular mt-0.5 text-[12px] text-fg-muted">
                        {qty(num(it.quantity))} × {formatBRL(it.unit_price)}
                        {num(it.discount) > 0 && <> · desc. {formatBRL(it.discount)}</>}
                      </p>
                    </div>
                    <Money value={it.total} className="shrink-0 text-sm font-semibold text-fg" />
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="hidden overflow-hidden md:block">
              <Table>
                <thead>
                  <tr>
                    <Th>Descrição</Th>
                    <Th className="text-right">Qtd.</Th>
                    <Th className="text-right">Unitário</Th>
                    <Th className="text-right">Desconto</Th>
                    <Th className="text-right">Total</Th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <Tr key={it.id}>
                      <Td className="max-w-[320px]">
                        <span className="block truncate font-medium">{it.description}</span>
                      </Td>
                      <Td className="tabular text-right">{qty(num(it.quantity))}</Td>
                      <Td className="text-right text-fg-muted">
                        <Money value={it.unit_price} />
                      </Td>
                      <Td className="text-right text-fg-muted">{num(it.discount) > 0 ? <Money value={it.discount} /> : "—"}</Td>
                      <Td className="text-right">
                        <Money value={it.total} className="font-semibold" />
                      </Td>
                    </Tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-right text-[13px] text-fg-muted">
                      Subtotal dos itens
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Money value={itemsSubtotal} className="font-semibold text-fg" />
                    </td>
                  </tr>
                </tfoot>
              </Table>
            </Card>
          </FadeIn>
        </div>

        {/* Resumo financeiro */}
        <FadeIn delay={0.06} className="lg:sticky lg:top-20">
          <Card>
            <CardBody className="space-y-4">
              <div className={cn("rounded-2xl px-4 py-4", paid ? "bg-success-soft" : "bg-paper text-paper-ink")}>
                {paid ? (
                  <div className="flex items-center gap-3">
                    <BadgeCheck className="h-8 w-8 shrink-0 text-success" aria-hidden />
                    <div>
                      <p className="text-[17px] font-semibold text-fg">Quitada</p>
                      <p className="text-[12.5px] text-fg-muted">Todo o valor de {formatBRL(total)} foi recebido.</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-[12px] font-medium text-paper-muted">
                      {cancelled ? "Saldo (venda cancelada)" : "Saldo restante"}
                    </p>
                    <p className="money mt-1 text-[28px] font-semibold leading-none tracking-tight">{formatBRL(sale.balance)}</p>
                    {!cancelled && (
                      <>
                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-paper-ink/10" aria-hidden>
                          <div className="h-full origin-left rounded-full bg-brand" style={{ transform: `scaleX(${progress})` }} />
                        </div>
                        <p className="mt-1.5 text-[12px] text-paper-muted">
                          {Math.round(progress * 100)}% recebido
                          {sale.next_collection_date && <> · próxima cobrança {formatDate(sale.next_collection_date)}</>}
                        </p>
                      </>
                    )}
                  </>
                )}
              </div>
              <div className="divide-y divide-line">
                <DataRow label="Subtotal" value={<Money value={sale.subtotal} />} />
                <DataRow label="Desconto" value={num(sale.discount) > 0 ? <Money value={-num(sale.discount)} /> : "—"} />
                <DataRow label="Total" value={<Money value={sale.total} className="font-semibold" />} />
                <DataRow label="Entrada" value={num(sale.down_payment) > 0 ? <Money value={sale.down_payment} /> : "—"} />
                <DataRow
                  label="Parcelamento"
                  value={sale.installments_count > 0 ? `${sale.installments_count}x` : num(sale.down_payment) >= total ? "À vista" : "—"}
                />
                <DataRow label="Pago" value={<Money value={sale.paid_total} className="text-success" />} />
                <DataRow label="Saldo restante" value={<Money value={sale.balance} className="font-semibold" />} />
              </div>
            </CardBody>
          </Card>

          {(sale.conditions || sale.notes) && (
            <Card className="mt-5">
              <CardHeader title="Condições e observações" />
              <CardBody className="space-y-3 text-sm">
                {sale.conditions && (
                  <div>
                    <p className="text-[12px] font-medium text-fg-muted">Condições</p>
                    <p className="mt-0.5 whitespace-pre-line text-fg">{sale.conditions}</p>
                  </div>
                )}
                {sale.notes && (
                  <div>
                    <p className="text-[12px] font-medium text-fg-muted">Observações</p>
                    <p className="mt-0.5 whitespace-pre-line text-fg">{sale.notes}</p>
                  </div>
                )}
              </CardBody>
            </Card>
          )}
        </FadeIn>
      </div>

      <section className="mt-7" aria-labelledby="parcelas-title">
        <SectionTitle>
          <span id="parcelas-title">Parcelas ({installments.length})</span>
        </SectionTitle>
        <SaleInstallments installments={installments} count={sale.installments_count} />
      </section>

      <section className="mt-7" aria-labelledby="pagamentos-title">
        <SectionTitle>
          <span id="pagamentos-title">Pagamentos ({payments.length})</span>
        </SectionTitle>
        <SalePayments payments={payments} />
      </section>
    </>
  );
}

function Info({ icon, label, value, className }: { icon: React.ReactNode; label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 items-start gap-2.5 bg-card px-4 py-3 sm:px-5", className)}>
      <span className="mt-0.5 shrink-0 text-bronze" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[12px] text-fg-muted">{label}</p>
        <p className="truncate text-sm font-medium text-fg">{value}</p>
      </div>
    </div>
  );
}
