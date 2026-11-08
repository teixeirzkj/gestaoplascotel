import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { Avatar, ContactButtons, Money, Table, Td, Th, Tr } from "@/components/ui/misc";
import { MotionItem, MotionList } from "@/components/ui/motion-list";
import { CUSTOMER_STATUS } from "@/lib/labels";
import { formatDate, formatPhone } from "@/lib/format";
import { num } from "@/lib/money";
import { todayISO } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { CustomerView } from "@/types/database";

function place(c: CustomerView) {
  return [c.city_name, c.neighborhood].filter(Boolean).join(" · ") || "Sem cidade";
}

function NextCollection({ date, today }: { date: string | null; today: string }) {
  if (!date) return <span className="text-fg-subtle">—</span>;
  const late = date < today;
  const isToday = date === today;
  return (
    <span className={cn("tabular", late ? "text-danger-fg" : isToday ? "text-warning" : "text-fg")}>
      {isToday ? "Hoje" : formatDate(date)}
    </span>
  );
}

export function CustomerList({ rows }: { rows: CustomerView[] }) {
  const today = todayISO();
  return (
    <>
      {/* Celular: cards */}
      <MotionList as="ul" className="space-y-2.5 md:hidden">
        {rows.map((c) => {
          const balance = num(c.balance);
          return (
            <MotionItem as="li" key={c.id} className="relative rounded-2xl border border-line bg-card p-3.5 shadow-card">
              <Link
                href={`/clientes/${c.id}`}
                aria-label={`Abrir ficha de ${c.full_name}`}
                className="absolute inset-0 rounded-2xl transition-colors active:bg-white/[0.03]"
              />
              <div className="pointer-events-none flex items-start gap-3">
                <Avatar name={c.full_name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold leading-tight text-fg">{c.full_name}</p>
                  <p className="mt-0.5 truncate text-[12.5px] text-fg-muted">{place(c)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <Money value={balance} className={cn("text-[15px] font-semibold", balance > 0 ? "text-fg" : "text-fg-subtle")} />
                  <p className="text-[11px] text-fg-subtle">em aberto</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
                <div className="pointer-events-none flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
                  {c.archived_at ? <Badge tone="muted">Arquivado</Badge> : <StatusBadge status={c.financial_status} map={CUSTOMER_STATUS} />}
                  {c.next_collection_date && (
                    <span className="text-[12px] text-fg-muted">
                      Próx. <NextCollection date={c.next_collection_date} today={today} />
                    </span>
                  )}
                </div>
                <ContactButtons phone={c.phone} whatsapp={c.whatsapp} size="icon" className="relative z-10" />
              </div>
            </MotionItem>
          );
        })}
      </MotionList>

      {/* Desktop: tabela */}
      <div className="hidden overflow-hidden rounded-2xl border border-line bg-card shadow-card md:block">
        <Table>
          <thead>
            <tr>
              <Th>Cliente</Th>
              <Th>Cidade</Th>
              <Th>Situação</Th>
              <Th className="text-right">Em aberto</Th>
              <Th className="text-right">Em atraso</Th>
              <Th>Próx. cobrança</Th>
              <Th className="w-[1%]">
                <span className="sr-only">Ações</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const overdue = num(c.overdue_amount);
              return (
                <Tr key={c.id}>
                  <Td>
                    <Link href={`/clientes/${c.id}`} className="group flex min-w-0 items-center gap-3">
                      <Avatar name={c.full_name} className="h-9 w-9" />
                      <span className="min-w-0">
                        <span className="block max-w-[260px] truncate font-medium text-fg group-hover:text-bronze">{c.full_name}</span>
                        <span className="tabular block text-[12px] text-fg-muted">{c.phone || c.whatsapp ? formatPhone(c.phone || c.whatsapp) : "Sem telefone"}</span>
                      </span>
                    </Link>
                  </Td>
                  <Td className="max-w-[200px] truncate text-fg-muted">{place(c)}</Td>
                  <Td>
                    {c.archived_at ? <Badge tone="muted">Arquivado</Badge> : <StatusBadge status={c.financial_status} map={CUSTOMER_STATUS} />}
                  </Td>
                  <Td className="text-right font-medium">
                    <Money value={c.balance} />
                  </Td>
                  <Td className={cn("text-right", overdue > 0 ? "text-danger-fg" : "text-fg-subtle")}>
                    <Money value={overdue} />
                  </Td>
                  <Td>
                    <NextCollection date={c.next_collection_date} today={today} />
                  </Td>
                  <Td>
                    <div className="flex items-center justify-end gap-1">
                      <ContactButtons phone={c.phone} whatsapp={c.whatsapp} />
                      <Link
                        href={`/clientes/${c.id}`}
                        aria-label={`Abrir ficha de ${c.full_name}`}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] text-fg-muted transition-colors hover:bg-white/5 hover:text-fg"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      </div>
    </>
  );
}
