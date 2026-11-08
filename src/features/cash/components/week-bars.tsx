import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { formatBRL, formatBRLCompact, formatDate, formatDayMonth } from "@/lib/format";
import { parseISODate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { DayTotal } from "../queries";

const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" });

/** Mini resumo dos últimos 7 dias: barras simples, cada uma leva ao dia. */
export function WeekBars({ days, selected, today }: { days: DayTotal[]; selected: string; today: string }) {
  const max = Math.max(...days.map((d) => Math.abs(d.total)), 0);
  const sum = days.reduce((a, d) => a + d.total, 0);
  const active = days.filter((d) => d.total !== 0).length;

  return (
    <Card>
      <CardHeader title="Últimos 7 dias" description={`Até ${formatDate(days[days.length - 1]?.date)} · toque num dia para abrir`} />
      <CardBody className="pt-4">
        <div className="flex h-36 items-end gap-1.5" role="list" aria-label="Total do caixa por dia">
          {days.map((d) => {
            const h = max > 0 ? Math.max((Math.abs(d.total) / max) * 100, d.total !== 0 ? 6 : 0) : 0;
            const isSel = d.date === selected;
            const href = d.date === today ? "/caixa" : `/caixa?data=${d.date}`;
            return (
              <Link
                key={d.date}
                href={href}
                scroll={false}
                role="listitem"
                aria-label={`${formatDate(d.date)}: ${formatBRL(d.total)}`}
                aria-current={isSel ? "date" : undefined}
                title={`${formatDate(d.date)} · ${formatBRL(d.total)}`}
                className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5 rounded-lg"
              >
                <span className={cn("money hidden text-[10.5px] leading-none sm:block", isSel ? "text-fg" : "text-fg-subtle")}>
                  {d.total !== 0 ? formatBRLCompact(d.total).replace("R$ ", "") : ""}
                </span>
                <span className="relative flex w-full flex-1 items-end justify-center">
                  <span
                    className={cn(
                      "block w-full max-w-7 rounded-t-[4px] transition-[opacity,background-color] duration-150 group-hover:opacity-100",
                      d.total < 0 ? "bg-danger" : isSel ? "bg-bronze" : "bg-bronze/45",
                      d.total === 0 && "h-[2px] rounded-[2px] bg-line-strong",
                    )}
                    style={d.total !== 0 ? { height: `${h}%` } : undefined}
                  />
                </span>
                <span className={cn("text-[11px] leading-none", isSel ? "font-semibold text-fg" : "text-fg-muted")}>
                  {weekday.format(parseISODate(d.date)).replace(".", "")}
                </span>
                <span className="tabular text-[10.5px] leading-none text-fg-subtle">{formatDayMonth(d.date)}</span>
              </Link>
            );
          })}
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-[13px]">
          <span className="text-fg-muted">Total no período</span>
          <span className="money font-semibold text-fg">{formatBRL(sum)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-[13px]">
          <span className="text-fg-muted">Média por dia com movimento</span>
          <span className="money text-fg">{formatBRL(active ? sum / active : 0)}</span>
        </div>
      </CardBody>
    </Card>
  );
}
