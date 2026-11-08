import { TIME_ZONE, parseISODate } from "./dates";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brlCompact = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 });
const NBSP = / /g;

/** R$ 1.500,00 */
export function formatBRL(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return brl.format(Number.isFinite(n) ? n : 0).replace(NBSP, " ");
}

/** R$ 1,5 mil */
export function formatBRLCompact(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return brlCompact.format(Number.isFinite(n) ? n : 0).replace(NBSP, " ");
}

/** 1234.5 -> "1.234,50" (para campos de entrada) */
export function formatMoneyInput(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

/** YYYY-MM-DD => DD/MM/AAAA */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** YYYY-MM-DD => DD/MM */
export function formatDayMonth(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}`;
}

/** "seg., 10 de novembro" */
export function formatDateLong(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "numeric", month: "long", timeZone: "UTC" }).format(parseISODate(iso));
}

/** "nov 26" */
export function formatMonthYear(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" })
    .format(parseISODate(iso))
    .replace(".", "")
    .replace(" de ", " ");
}

/** Timestamp => DD/MM/AAAA HH:mm (America/Bahia) */
export function formatDateTime(ts: string | null | undefined): string {
  if (!ts) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(ts)).replace(",", "");
}

/** Timestamp => HH:mm (America/Bahia) */
export function formatTime(ts: string | null | undefined): string {
  if (!ts) return "";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" }).format(new Date(ts));
}

/** Timestamp => YYYY-MM-DD no fuso da Bahia */
export function tsToBahiaDate(ts: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ts));
}

export function formatRelativeDays(days: number): string {
  if (days === 0) return "hoje";
  if (days === 1) return "amanhã";
  if (days === -1) return "ontem";
  return days > 0 ? `em ${days} dias` : `há ${Math.abs(days)} dias`;
}

/** (74) 99999-0000 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "—";
  const d = phone.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return phone;
}

/** Máscara progressiva de telefone para digitação */
export function maskPhone(input: string): string {
  const d = input.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Link wa.me — apenas abre o WhatsApp do usuário. Nenhum disparo automático. */
export function whatsappLink(phone: string | null | undefined, message?: string): string | null {
  if (!phone) return null;
  let d = phone.replace(/\D/g, "");
  if (d.length < 10) return null;
  if (!d.startsWith("55")) d = "55" + d;
  return `https://wa.me/${d}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}

export function telLink(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const d = phone.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  return d.length >= 8 ? `tel:+55${d}` : null;
}
