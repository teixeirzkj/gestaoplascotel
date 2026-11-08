"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, ChevronRight, MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { MotionItem, MotionList } from "@/components/ui/motion-list";
import { Money, Table, Td, Th, Tr } from "@/components/ui/misc";
import { formatDate, formatDayMonth } from "@/lib/format";
import { SALE_STATUS } from "@/lib/labels";
import { num } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { SaleListRow } from "../queries";

function NextCharge({ row, today }: { row: SaleListRow; today: string }) {
  if (row.status !== "open" || !row.next_collection_date) return <span className="text-fg-subtle">—</span>;
  const late = row.next_collection_date < today;
  return (
    <span className={cn("tabular", late ? "font-medium text-danger-fg" : "text-fg")}>
      {formatDate(row.next_collection_date)}
      {late && <span className="sr-only"> (atrasada)</span>}
    </span>
  );
}

export function SalesList({ rows, today }: { rows: SaleListRow[]; today: string }) {
  const router = useRouter();

  return (
    <>
      {/* Celular: cards */}
      <MotionList className="space-y-2 md:hidden">
        {rows.map((s) => {
          const cancelled = s.status === "cancelled";
          const late = s.status === "open" && s.next_collection_date !== null && s.next_collection_date < today;
          return (
            <MotionItem key={s.id}>
              <Link
                href={`/vendas/${s.id}`}
                className={cn(
                  "block rounded-2xl border border-line bg-card p-3.5 shadow-card transition-transform active:scale-[0.98]",
                  cancelled && "opacity-65",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="tabular text-[13px] font-semibold text-bronze">#{s.code}</span>
                  <StatusBadge status={s.status} map={SALE_STATUS} />
                </div>
                <p className="mt-1.5 truncate text-[15px] font-semibold text-fg">{s.customer_name}</p>
                <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[12px] text-fg-muted">
                  <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{s.city_name ?? "Sem cidade"}</span>
                  <span aria-hidden>·</span>
                  <span className="tabular shrink-0">{formatDate(s.sale_date)}</span>
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3">
                  <div className="min-w-0">
                    <p className="text-[11.5px] text-fg-muted">Total</p>
                    <Money value={s.total} className={cn("block truncate text-[14px] font-semibold", cancelled && "line-through")} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11.5px] text-fg-muted">Pago</p>
                    <Money value={s.paid_total} className="block truncate text-[14px] text-fg" />
                  </div>
                  <div className="min-w-0 text-right">
                    <p className="text-[11.5px] text-fg-muted">Saldo</p>
                    <Money
                      value={s.balance}
                      className={cn("block truncate text-[14px] font-semibold", num(s.balance) > 0 ? (late ? "text-danger-fg" : "text-fg") : "text-success")}
                    />
                  </div>
                </div>
                {s.status === "open" && (
                  <div className="mt-2.5 flex items-center justify-between gap-2 text-[12px]">
                    <span className="text-fg-muted">
                      {s.open_installments} {s.open_installments === 1 ? "parcela aberta" : "parcelas abertas"}
                    </span>
                    {s.next_collection_date && (
                      <span className={cn("inline-flex items-center gap-1", late ? "font-medium text-danger-fg" : "text-fg-muted")}>
                        <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                        {late ? "Atrasada desde " : "Próx. "}
                        <span className="tabular">{formatDayMonth(s.next_collection_date)}</span>
                      </span>
                    )}
                  </div>
                )}
              </Link>
            </MotionItem>
          );
        })}
      </MotionList>

      {/* Desktop: tabela */}
      <Card className="hidden overflow-hidden md:block">
        <Table>
          <thead>
            <tr>
              <Th>Venda</Th>
              <Th>Cliente</Th>
              <Th className="hidden lg:table-cell">Cidade</Th>
              <Th>Data</Th>
              <Th className="text-right">Total</Th>
              <Th className="hidden text-right xl:table-cell">Pago</Th>
              <Th className="text-right">Saldo</Th>
              <Th className="hidden text-center lg:table-cell">Abertas</Th>
              <Th>Próx. cobrança</Th>
              <Th>Situação</Th>
              <Th className="w-10">
                <span className="sr-only">Abrir</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <Tr key={s.id} className={cn("cursor-pointer", s.status === "cancelled" && "opacity-65")} onClick={() => router.push(`/vendas/${s.id}`)}>
                <Td>
                  <Link href={`/vendas/${s.id}`} className="tabular font-semibold text-bronze hover:underline" onClick={(e) => e.stopPropagation()}>
                    #{s.code}
                  </Link>
                </Td>
                <Td className="max-w-[220px]">
                  <span className="block truncate font-medium">{s.customer_name}</span>
                </Td>
                <Td className="hidden max-w-[160px] text-fg-muted lg:table-cell">
                  <span className="block truncate">{s.city_name ?? "—"}</span>
                </Td>
                <Td className="tabular whitespace-nowrap text-fg-muted">{formatDate(s.sale_date)}</Td>
                <Td className="text-right">
                  <Money value={s.total} className={cn("font-medium", s.status === "cancelled" && "line-through")} />
                </Td>
                <Td className="hidden text-right text-fg-muted xl:table-cell">
                  <Money value={s.paid_total} />
                </Td>
                <Td className="text-right">
                  <Money value={s.balance} className={cn("font-semibold", num(s.balance) === 0 && s.status !== "cancelled" && "text-success")} />
                </Td>
                <Td className="tabular hidden text-center text-fg-muted lg:table-cell">{s.status === "open" ? s.open_installments : "—"}</Td>
                <Td className="whitespace-nowrap">
                  <NextCharge row={s} today={today} />
                </Td>
                <Td>
                  <StatusBadge status={s.status} map={SALE_STATUS} />
                </Td>
                <Td>
                  <ChevronRight className="h-4 w-4 text-fg-subtle" aria-hidden />
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
