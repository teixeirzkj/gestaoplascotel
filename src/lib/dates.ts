/** Datas de negócio no fuso America/Bahia. Datas trafegam como "YYYY-MM-DD" (sem horário). */
export const TIME_ZONE = "America/Bahia";

/** Hoje em America/Bahia como YYYY-MM-DD. */
export function todayISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Converte YYYY-MM-DD para Date em UTC ao meio-dia (evita troca de dia por fuso). */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}

/** Soma meses preservando o dia quando possível (31/01 + 1 mês => último dia de fevereiro). */
export function addMonths(iso: string, months: number): string {
  const d = parseISODate(iso);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return toISODate(d);
}

export function diffDays(fromISO: string, toISO: string): number {
  return Math.round((parseISODate(toISO).getTime() - parseISODate(fromISO).getTime()) / 86_400_000);
}

export function startOfMonthISO(iso: string): string {
  return iso.slice(0, 8) + "01";
}

export function endOfMonthISO(iso: string): string {
  const d = parseISODate(startOfMonthISO(iso));
  return toISODate(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 12)));
}

export type PeriodKey = "today" | "7d" | "30d" | "month" | "last_month" | "custom";

export const PERIOD_OPTIONS: { value: PeriodKey; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "month", label: "Este mês" },
  { value: "last_month", label: "Mês anterior" },
  { value: "custom", label: "Personalizado" },
];

export function periodRange(key: PeriodKey, custom?: { from?: string; to?: string }): { from: string; to: string } {
  const today = todayISO();
  switch (key) {
    case "today":
      return { from: today, to: today };
    case "7d":
      return { from: addDays(today, -6), to: today };
    case "30d":
      return { from: addDays(today, -29), to: today };
    case "month":
      return { from: startOfMonthISO(today), to: today };
    case "last_month": {
      const prev = addMonths(startOfMonthISO(today), -1);
      return { from: prev, to: endOfMonthISO(prev) };
    }
    case "custom":
    default:
      return { from: custom?.from || startOfMonthISO(today), to: custom?.to || today };
  }
}

export function isISODate(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}
