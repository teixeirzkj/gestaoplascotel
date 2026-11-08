import { diffDays, parseISODate } from "@/lib/dates";
import { formatDateLong, formatRelativeDays } from "@/lib/format";

export const AGENDA_VIEWS = ["lista", "calendario", "historico", "roteiro"] as const;
export type AgendaView = (typeof AGENDA_VIEWS)[number];

/** "14:30:00" -> "14:30" */
export function formatVisitTime(time: string | null | undefined): string | null {
  if (!time) return null;
  return time.slice(0, 5);
}

/** Rótulo relativo curto para uma data de negócio ("hoje", "amanhã", "em 3 dias", "há 2 dias"). */
export function relativeDayLabel(iso: string | null | undefined, today: string): string | null {
  if (!iso) return null;
  return formatRelativeDays(diffDays(today, iso));
}

/** "YYYY-MM" válido ou null */
export function parseMonthParam(v: string | undefined | null): string | null {
  if (!v || !/^\d{4}-(0[1-9]|1[0-2])$/.test(v)) return null;
  return v;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1, 12));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Maiúscula só na primeira letra (a classe CSS `capitalize` afetaria também o "de"). */
export function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "Novembro de 2026" */
export function formatMonthTitle(month: string): string {
  return capitalizeFirst(
    new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(parseISODate(`${month}-01`)),
  );
}

/** "Seg., 9 de novembro": data por extenso para títulos. */
export function formatDateTitle(iso: string | null | undefined): string {
  return capitalizeFirst(formatDateLong(iso));
}

/** Dia da semana curto ("seg.") */
export function weekdayShort(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" }).format(parseISODate(iso)).replace(".", "");
}

/** Agrupa itens por chave preservando a ordem de chegada. */
export function groupBy<T>(items: T[], key: (item: T) => string): { key: string; items: T[] }[] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return Array.from(map, ([k, list]) => ({ key: k, items: list }));
}

/** Link de busca no Google Maps (abre o app do usuário; não há integração de mapa embutida). */
export function mapsSearchLink(parts: {
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
}): string | null {
  if (parts.lat != null && parts.lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${parts.lat},${parts.lng}`;
  }
  const text = [parts.address, parts.neighborhood, parts.city && parts.state ? `${parts.city} - ${parts.state}` : parts.city]
    .filter((x): x is string => Boolean(x && x.trim()))
    .join(", ");
  if (!parts.address && !parts.neighborhood) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}`;
}
