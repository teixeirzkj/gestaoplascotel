"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarPlus, ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { MotionItem, MotionList, SwapContent } from "@/components/ui/motion-list";
import { formatDateLong } from "@/lib/format";
import { cn } from "@/lib/utils";
import { formatDateTitle, formatMonthTitle, formatVisitTime, shiftMonth } from "../utils";
import type { VisitSummary } from "../types";
import { VisitCard } from "./visit-card";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const STATUS_DOT: Record<string, string> = { planned: "bg-bronze", done: "bg-success", cancelled: "bg-fg-subtle" };
const STATUS_CHIP: Record<string, string> = {
  planned: "border-bronze/30 bg-bronze-soft text-fg hover:border-bronze/60",
  done: "border-success/25 bg-success-soft text-fg hover:border-success/50",
  cancelled: "border-line bg-white/[0.03] text-fg-subtle line-through hover:border-line-strong",
};

function monthDays(month: string): (string | null)[] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1, 12));
  const lastDay = new Date(Date.UTC(y, m, 0, 12)).getUTCDate();
  const cells: (string | null)[] = Array.from({ length: first.getUTCDay() }, () => null);
  for (let d = 1; d <= lastDay; d++) cells.push(`${month}-${String(d).padStart(2, "0")}`);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function VisitCalendar({ month, visits, today }: { month: string; visits: VisitSummary[]; today: string }) {
  const byDay = useMemo(() => {
    const map = new Map<string, VisitSummary[]>();
    for (const v of visits) {
      const list = map.get(v.visitDate);
      if (list) list.push(v);
      else map.set(v.visitDate, [v]);
    }
    return map;
  }, [visits]);

  const initialDay = today.startsWith(month) ? today : (visits.find((v) => v.status !== "cancelled")?.visitDate ?? `${month}-01`);
  const [selected, setSelected] = useState(initialDay);
  const cells = monthDays(month);
  const dayVisits = byDay.get(selected) ?? [];
  const href = (m: string) => `/agenda?visao=calendario&mes=${m}`;
  const planned = visits.filter((v) => v.status === "planned").length;
  const done = visits.filter((v) => v.status === "done").length;

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-line px-2 py-2 sm:px-4">
          <Link
            href={href(shiftMonth(month, -1))}
            scroll={false}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-fg-muted transition-colors hover:bg-white/5 hover:text-fg"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 text-center">
            <h2 className="text-[16px] font-semibold tracking-tight text-fg sm:text-[18px]">{formatMonthTitle(month)}</h2>
            <p className="tabular text-[12px] text-fg-subtle">
              {planned} {planned === 1 ? "planejada" : "planejadas"} · {done} {done === 1 ? "realizada" : "realizadas"}
            </p>
          </div>
          <div className="flex items-center">
            {!today.startsWith(month) && (
              <Link
                href={href(today.slice(0, 7))}
                scroll={false}
                className="hidden h-9 items-center rounded-lg px-3 text-[13px] font-medium text-bronze hover:bg-bronze-soft xs:inline-flex"
              >
                Hoje
              </Link>
            )}
            <Link
              href={href(shiftMonth(month, 1))}
              scroll={false}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-fg-muted transition-colors hover:bg-white/5 hover:text-fg"
              aria-label="Próximo mês"
            >
              <ChevronRight className="h-5 w-5" />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-line">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-2 text-center text-[11px] font-medium uppercase tracking-[0.06em] text-fg-subtle">
              {w}
            </div>
          ))}
        </div>

        {/* Celular: grade compacta com pontos */}
        <div className="grid grid-cols-7 gap-y-1 p-1.5 md:hidden">
          {cells.map((day, i) => {
            if (!day) return <span key={`e${i}`} aria-hidden />;
            const list = byDay.get(day) ?? [];
            const isSel = day === selected;
            const isToday = day === today;
            return (
              <button
                key={day}
                type="button"
                onClick={() => setSelected(day)}
                aria-pressed={isSel}
                aria-label={`${formatDateLong(day)}${list.length ? `, ${list.length} ${list.length === 1 ? "visita" : "visitas"}` : ""}`}
                className={cn(
                  "mx-auto flex h-12 w-full max-w-12 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl transition-colors",
                  isSel ? "bg-paper text-paper-ink" : isToday ? "bg-bronze-soft text-fg" : "text-fg hover:bg-white/5",
                )}
              >
                <span className={cn("tabular text-[14px] leading-none", (isSel || isToday) && "font-semibold")}>{Number(day.slice(8))}</span>
                <span className="flex h-1.5 items-center gap-0.5" aria-hidden>
                  {list.slice(0, 3).map((v) => (
                    <span key={v.id} className={cn("h-1.5 w-1.5 rounded-full", isSel ? "bg-brand" : STATUS_DOT[v.status])} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>

        {/* Desktop: grade mensal com chips de cidade */}
        <div className="hidden grid-cols-7 md:grid">
          {cells.map((day, i) => {
            if (!day) return <div key={`e${i}`} className="min-h-[116px] border-b border-r border-line bg-white/[0.01] [&:nth-child(7n)]:border-r-0" aria-hidden />;
            const list = byDay.get(day) ?? [];
            const isSel = day === selected;
            const isToday = day === today;
            return (
              <div
                key={day}
                className={cn(
                  "group relative min-h-[116px] border-b border-r border-line p-1.5 transition-colors [&:nth-child(7n)]:border-r-0",
                  isSel && "bg-white/[0.035]",
                )}
              >
                <button
                  type="button"
                  onClick={() => setSelected(day)}
                  aria-pressed={isSel}
                  aria-label={`Selecionar ${formatDateLong(day)}`}
                  className={cn(
                    "tabular mb-1 inline-flex h-7 min-w-7 cursor-pointer items-center justify-center rounded-lg px-1.5 text-[13px] transition-colors",
                    isToday ? "bg-paper font-semibold text-paper-ink" : isSel ? "bg-bronze-soft font-semibold text-fg" : "text-fg-muted hover:bg-white/5 hover:text-fg",
                  )}
                >
                  {Number(day.slice(8))}
                </button>
                <div className="space-y-1">
                  {list.slice(0, 3).map((v) => (
                    <Link
                      key={v.id}
                      href={`/agenda/${v.id}`}
                      className={cn("block truncate rounded-md border px-1.5 py-1 text-[11.5px] font-medium transition-colors", STATUS_CHIP[v.status])}
                      title={`${v.cityName}/${v.cityState}${v.visitTime ? ` · ${formatVisitTime(v.visitTime)}` : ""}`}
                    >
                      {v.visitTime && <span className="tabular mr-1 text-fg-subtle">{formatVisitTime(v.visitTime)}</span>}
                      {v.cityName}
                    </Link>
                  ))}
                  {list.length > 3 && (
                    <button
                      type="button"
                      onClick={() => setSelected(day)}
                      className="w-full cursor-pointer rounded-md px-1.5 py-0.5 text-left text-[11.5px] font-medium text-bronze hover:bg-bronze-soft"
                    >
                      +{list.length - 3} mais
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-[11.5px] text-fg-subtle">
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-bronze" aria-hidden />Planejada</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-success" aria-hidden />Realizada</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-fg-subtle" aria-hidden />Cancelada</span>
        </div>
      </Card>

      <section aria-live="polite">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-[15px] font-semibold text-fg">{selected === today ? "Hoje" : formatDateTitle(selected)}</h3>
          <ButtonLink href={`/agenda?visao=calendario&mes=${month}&nova=1&dia=${selected}`} scroll={false} variant="secondary" size="sm">
            <CalendarPlus className="h-4 w-4" /> Agendar neste dia
          </ButtonLink>
        </div>
        <SwapContent id={selected}>
          {dayVisits.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-[13px] text-fg-subtle">Nenhuma visita neste dia.</p>
          ) : (
            <MotionList className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              {dayVisits.map((v) => (
                <MotionItem key={v.id}>
                  <VisitCard visit={v} />
                </MotionItem>
              ))}
            </MotionList>
          )}
        </SwapContent>
      </section>
    </div>
  );
}
