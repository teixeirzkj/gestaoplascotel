"use client";

import Link from "next/link";
import { AlertTriangle, CalendarDays, CalendarPlus, MapPin } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { Money } from "@/components/ui/misc";
import { MotionItem, MotionList } from "@/components/ui/motion-list";
import { SectionTitle } from "@/components/ui/page-header";
import { formatDate } from "@/lib/format";
import { parseISODate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { groupBy, relativeDayLabel, weekdayShort } from "../utils";
import type { CityNeedingVisit, VisitSummary } from "../types";
import { VisitCard } from "./visit-card";

function DateRail({ date, today }: { date: string; today: string }) {
  const d = parseISODate(date);
  const isToday = date === today;
  const month = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" }).format(d).replace(".", "");
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border",
          isToday ? "border-transparent bg-paper text-paper-ink" : "border-line bg-bg-elevated text-fg",
        )}
      >
        <span className="tabular text-[17px] font-semibold leading-none">{d.getUTCDate()}</span>
        <span className={cn("mt-0.5 text-[10.5px] font-medium uppercase", isToday ? "text-paper-muted" : "text-fg-subtle")}>{month}</span>
      </div>
      <div className="min-w-0">
        <p className="text-[14px] font-semibold capitalize text-fg">{isToday ? "Hoje" : weekdayShort(date)}</p>
        <p className="tabular text-[12px] text-fg-subtle">
          {formatDate(date)}
          {!isToday && <> · {relativeDayLabel(date, today)}</>}
        </p>
      </div>
    </div>
  );
}

export function VisitListView({
  visits,
  citiesNeeding,
  today,
  newVisitAction,
}: {
  visits: VisitSummary[];
  citiesNeeding: CityNeedingVisit[];
  today: string;
  /** Botão "Nova visita" para o estado vazio */
  newVisitAction: React.ReactNode;
}) {
  const late = visits.filter((v) => v.visitDate < today);
  const upcoming = visits.filter((v) => v.visitDate >= today);
  const groups = groupBy(upcoming, (v) => v.visitDate);

  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-6">
        {late.length > 0 && (
          <section aria-labelledby="late-title">
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-warning/25 bg-warning-soft px-3.5 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
              <div>
                <p id="late-title" className="text-[13.5px] font-semibold text-fg">
                  {late.length === 1 ? "1 visita passada ainda aberta" : `${late.length} visitas passadas ainda abertas`}
                </p>
                <p className="text-[12.5px] text-fg-muted">Registre os atendimentos e marque como realizada, ou cancele.</p>
              </div>
            </div>
            <MotionList className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {late.map((v) => (
                <MotionItem key={v.id}>
                  <div className="mb-1.5 tabular text-[12px] font-medium text-warning">
                    {formatDate(v.visitDate)} · {relativeDayLabel(v.visitDate, today)}
                  </div>
                  <VisitCard visit={v} showStatus={false} />
                </MotionItem>
              ))}
            </MotionList>
          </section>
        )}

        {groups.length === 0 ? (
          <Card>
            <EmptyState
              icon={<CalendarDays className="h-5 w-5" />}
              title="Nenhuma visita agendada"
              description="Agende visitas às cidades para organizar as cobranças presenciais e o roteiro de campo."
              action={newVisitAction}
            />
          </Card>
        ) : (
          groups.map((g) => (
            <section key={g.key} aria-label={formatDate(g.key)}>
              <div className="mb-3">
                <DateRail date={g.key} today={today} />
              </div>
              <MotionList className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {g.items.map((v) => (
                  <MotionItem key={v.id}>
                    <VisitCard visit={v} showStatus={false} />
                  </MotionItem>
                ))}
              </MotionList>
            </section>
          ))
        )}
      </div>

      <aside className="min-w-0 space-y-5">
        <Card>
          <CardHeader
            icon={<MapPin className="h-4 w-4" />}
            title="Aguardando agendamento"
            description="Cidades com atraso ou pedido de visita e sem visita futura."
          />
          <div className="mt-3 border-t border-line">
            {citiesNeeding.length === 0 ? (
              <p className="px-4 py-4 text-[13px] text-fg-subtle sm:px-5">Todas as cidades com pendências já têm visita agendada.</p>
            ) : (
              <ul className="divide-y divide-line">
                {citiesNeeding.map((c) => (
                  <li key={c.cityId} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    <Link href={`/cidades/${c.cityId}`} className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium text-fg hover:text-bronze">
                        {c.cityName}
                        <span className="ml-1 text-[12px] text-fg-subtle">{c.cityState}</span>
                      </p>
                      <p className="truncate text-[12px] text-fg-subtle">
                        {c.overdue > 0 && (
                          <>
                            <Money value={c.overdue} className="text-danger" /> em atraso
                          </>
                        )}
                        {c.overdue > 0 && c.visitRequests > 0 && " · "}
                        {c.visitRequests > 0 && `${c.visitRequests} ${c.visitRequests === 1 ? "pedido" : "pedidos"} de visita`}
                      </p>
                      <p className="text-[11.5px] text-fg-subtle">
                        Última visita: <span className="tabular">{c.lastVisitDate ? formatDate(c.lastVisitDate) : "nunca"}</span>
                      </p>
                    </Link>
                    <Link
                      href={`/agenda?nova=1&cidade=${c.cityId}`}
                      scroll={false}
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line text-bronze transition-colors hover:bg-bronze-soft"
                      aria-label={`Agendar visita para ${c.cityName}`}
                      title="Agendar visita"
                    >
                      <CalendarPlus className="h-4 w-4" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
        <div className="hidden lg:block">
          <SectionTitle>Lembrete</SectionTitle>
          <p className="text-[12.5px] leading-relaxed text-fg-subtle">
            A data de visita organiza o trabalho de campo. Ela não muda o vencimento financeiro nem a data de cobrança das parcelas — para isso use “Adiar” na
            cobrança.
          </p>
        </div>
      </aside>
    </div>
  );
}
