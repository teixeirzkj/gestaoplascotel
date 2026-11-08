"use client";

import { CalendarDays, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useUrlParams } from "@/components/ui/url-controls";
import { addDays, isISODate } from "@/lib/dates";
import { formatDate, formatDateLong } from "@/lib/format";
import { cn } from "@/lib/utils";

const arrow =
  "inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-line bg-card text-fg transition-[background-color,transform] duration-150 hover:bg-card-hover active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40";

/** Navegação de data do caixa (?data=). Não permite datas futuras. */
export function DateNav({ date, today }: { date: string; today: string }) {
  const { set, pending } = useUrlParams();
  const go = (d: string) => set({ data: d === today ? null : d });
  const isToday = date === today;

  return (
    <div className="flex items-center gap-2">
      <button type="button" className={arrow} onClick={() => go(addDays(date, -1))} aria-label="Dia anterior">
        <ChevronLeft className="h-5 w-5" />
      </button>

      <label className="relative flex h-11 min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-card px-3.5 transition-colors hover:bg-card-hover sm:flex-none sm:min-w-[260px]">
        {pending ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-bronze" aria-hidden />
        ) : (
          <CalendarDays className="h-4 w-4 shrink-0 text-bronze" aria-hidden />
        )}
        <span className="min-w-0 truncate text-sm">
          <span className="font-semibold text-fg">{isToday ? "Hoje" : formatDate(date)}</span>
          <span className="ml-1.5 text-fg-muted">{formatDateLong(date)}</span>
        </span>
        <input
          type="date"
          value={date}
          max={today}
          aria-label="Escolher data do caixa"
          onClick={(e) => {
            try {
              e.currentTarget.showPicker();
            } catch {
              // navegador sem showPicker: o seletor nativo abre normalmente
            }
          }}
          onChange={(e) => {
            const v = e.target.value;
            if (isISODate(v)) go(v > today ? today : v);
          }}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
        />
      </label>

      <button type="button" className={arrow} onClick={() => go(addDays(date, 1))} disabled={isToday} aria-label="Próximo dia">
        <ChevronRight className="h-5 w-5" />
      </button>

      {!isToday && (
        <button
          type="button"
          onClick={() => go(today)}
          className={cn(
            "hidden h-11 shrink-0 cursor-pointer items-center rounded-xl px-3 text-[13px] font-medium text-bronze transition-colors hover:bg-bronze-soft xs:inline-flex",
          )}
        >
          Hoje
        </button>
      )}
    </div>
  );
}
