"use client";

import Link from "next/link";
import { CalendarClock, CalendarCheck2, ChevronRight, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Money, Table, Td, Th, Tr } from "@/components/ui/misc";
import { MotionItem, MotionList } from "@/components/ui/motion-list";
import { useShellUser } from "@/components/layout/app-shell";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { relativeDayLabel } from "@/features/agenda/utils";
import type { CityListItem } from "../queries";
import { CityOwnerActions } from "./city-owner-actions";

function VisitInfo({ label, date, today, icon: Icon, accent }: {
  label: string;
  date: string | null;
  today: string;
  icon: typeof CalendarCheck2;
  accent?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1 text-[11.5px] text-fg-subtle">
        <Icon className={cn("h-3.5 w-3.5", accent ? "text-bronze" : "text-fg-subtle")} aria-hidden />
        {label}
      </p>
      <p className="tabular mt-0.5 truncate text-[13px] font-medium text-fg">
        {date ? formatDate(date) : "—"}
        {date && <span className="ml-1 font-normal text-fg-subtle">· {relativeDayLabel(date, today)}</span>}
      </p>
    </div>
  );
}

export function CityList({ items, today }: { items: CityListItem[]; today: string }) {
  const user = useShellUser();
  return (
    <>
      {/* Celular: cards */}
      <MotionList className="grid gap-2.5 md:hidden">
        {items.map((c) => (
          <MotionItem key={c.id}>
            <Link
              href={`/cidades/${c.id}`}
              className="block rounded-2xl border border-line bg-card p-4 shadow-card transition-transform active:scale-[0.98]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold tracking-tight text-fg">
                    {c.name}
                    <span className="ml-1.5 text-[12px] font-medium text-fg-subtle">{c.state}</span>
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-[12px] text-fg-muted">
                    <Users className="h-3.5 w-3.5" aria-hidden />
                    {c.customersCount} {c.customersCount === 1 ? "cliente" : "clientes"}
                    {c.overdueCustomers > 0 && <span className="text-fg-subtle">· {c.overdueCustomers} em atraso</span>}
                  </p>
                </div>
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-fg-subtle" aria-hidden />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-bg-elevated px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-[11.5px] text-fg-subtle">Pendente</p>
                  <Money value={c.pending} className="mt-0.5 block text-[15px] font-semibold text-fg" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11.5px] text-fg-subtle">Em atraso</p>
                  <Money value={c.overdue} className={cn("mt-0.5 block text-[15px] font-semibold", c.overdue > 0 ? "text-danger" : "text-fg-muted")} />
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <VisitInfo label="Última visita" date={c.lastVisitDate} today={today} icon={CalendarCheck2} />
                <VisitInfo label="Próxima visita" date={c.nextVisitDate} today={today} icon={CalendarClock} accent />
              </div>
              {c.notes && <p className="mt-3 line-clamp-2 border-t border-line pt-2.5 text-[12.5px] leading-relaxed text-fg-muted">{c.notes}</p>}
            </Link>
          </MotionItem>
        ))}
      </MotionList>

      {/* Desktop: tabela */}
      <Card className="hidden md:block">
        <Table>
          <thead>
            <tr>
              <Th>Cidade</Th>
              <Th className="text-right">Clientes</Th>
              <Th className="text-right">Pendente</Th>
              <Th className="text-right">Em atraso</Th>
              <Th>Última visita</Th>
              <Th>Próxima visita</Th>
              {user.isOwner && <Th className="w-24 text-right">Ações</Th>}
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <Tr key={c.id}>
                <Td className="max-w-[280px]">
                  <Link href={`/cidades/${c.id}`} className="group block min-w-0">
                    <span className="font-medium text-fg group-hover:text-bronze">{c.name}</span>
                    <span className="ml-1.5 text-[12px] text-fg-subtle">{c.state}</span>
                    {c.notes && <span className="mt-0.5 block truncate text-[12px] text-fg-muted">{c.notes}</span>}
                  </Link>
                </Td>
                <Td className="tabular text-right">
                  {c.customersCount}
                  {c.overdueCustomers > 0 && <span className="block text-[11.5px] text-fg-subtle">{c.overdueCustomers} em atraso</span>}
                </Td>
                <Td className="text-right">
                  <Money value={c.pending} className="font-medium" />
                </Td>
                <Td className="text-right">
                  {c.overdue > 0 ? <Money value={c.overdue} className="font-medium text-danger" /> : <span className="text-fg-subtle">—</span>}
                </Td>
                <Td className="tabular whitespace-nowrap text-[13px]">
                  {c.lastVisitDate ? (
                    <>
                      {formatDate(c.lastVisitDate)}
                      <span className="block text-[11.5px] text-fg-subtle">{relativeDayLabel(c.lastVisitDate, today)}</span>
                    </>
                  ) : (
                    <span className="text-fg-subtle">Nunca visitada</span>
                  )}
                </Td>
                <Td className="whitespace-nowrap text-[13px]">
                  {c.nextVisitDate ? (
                    <Badge tone="brand" dot={false} className="tabular">
                      {formatDate(c.nextVisitDate)} · {relativeDayLabel(c.nextVisitDate, today)}
                    </Badge>
                  ) : (
                    <span className="text-fg-subtle">Sem agendamento</span>
                  )}
                </Td>
                {user.isOwner && (
                  <Td className="text-right">
                    <CityOwnerActions compact archived={c.archived} city={{ id: c.id, name: c.name, state: c.state, notes: c.notes }} />
                  </Td>
                )}
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
