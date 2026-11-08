/**
 * Cálculos de PRÉ-VISUALIZAÇÃO da venda em centavos inteiros (espelham create_sale).
 * O banco recalcula e valida tudo novamente.
 */
import { addDays, addMonths, endOfMonthISO } from "@/lib/dates";
import { splitCents } from "@/lib/money";

/** Reais (number) -> centavos inteiros, sem erro de ponto flutuante. */
export function toMoneyCents(value: number): number {
  return Math.round(Number((value * 100).toFixed(4)));
}

/** Quantidade -> milésimos inteiros (numeric(12,3) no banco). */
export function toMilli(quantity: number): number {
  return Math.round(Number((quantity * 1000).toFixed(4)));
}

/** round(qtd × unitário, 2) − desconto, em centavos. */
export function lineCents(quantity: number, unitCents: number, discountCents: number): number {
  const gross = Math.round((toMilli(quantity) * unitCents) / 1000);
  return gross - discountCents;
}

export type CalcItem = { quantity: number; unitCents: number; discountCents: number };

export function saleTotals(items: CalcItem[], discountCents: number) {
  const lines = items.map((i) => lineCents(i.quantity, i.unitCents, i.discountCents));
  const subtotalCents = lines.reduce((a, b) => a + b, 0);
  return { lines, subtotalCents, discountCents, totalCents: subtotalCents - discountCents };
}

/** Converte texto digitado ("1,5", "2.25") em número; NaN se inválido. */
export function parseQuantity(input: string): number {
  const s = input.trim().replace(/\s/g, "").replace(",", ".");
  if (!s || !/^\d*\.?\d*$/.test(s)) return Number.NaN;
  return Number(s);
}

export type IntervalKey = "monthly" | "7" | "15" | "30";

export const INTERVAL_OPTIONS: { value: IntervalKey; label: string }[] = [
  { value: "monthly", label: "Mensal" },
  { value: "7", label: "A cada 7 dias" },
  { value: "15", label: "A cada 15 dias" },
  { value: "30", label: "A cada 30 dias" },
];

/** Converte o intervalo padrão das configurações (dias) no intervalo do formulário: 7, 15 ou mensal. */
export function intervalFromDays(days: number): IntervalKey {
  return days === 7 ? "7" : days === 15 ? "15" : "monthly";
}

/** Soma meses mirando um dia fixo do mês (limitado ao último dia do mês de destino). */
function addMonthsAnchored(iso: string, months: number, anchorDay: number): string {
  const first = addMonths(iso.slice(0, 8) + "01", months);
  const last = Number(endOfMonthISO(first).slice(8, 10));
  return first.slice(0, 8) + String(Math.min(anchorDay, last)).padStart(2, "0");
}

/**
 * Vencimento da parcela `index` (0 = primeira).
 * Mensal: mantém o dia âncora em todos os meses (venda em 31/01 => 28/02, 31/03, 30/04…),
 * em vez de encadear a partir de um vencimento já limitado ao fim do mês.
 */
export function dueDateFor(firstDue: string, index: number, interval: IntervalKey, anchorDay?: number): string {
  if (index === 0) return firstDue;
  if (interval !== "monthly") return addDays(firstDue, index * Number(interval));
  return addMonthsAnchored(firstDue, index, anchorDay ?? Number(firstDue.slice(8, 10)));
}

/** Primeiro vencimento sugerido a partir da data da venda. */
export function defaultFirstDue(saleDate: string, interval: IntervalKey): string {
  return interval === "monthly" ? addMonths(saleDate, 1) : addDays(saleDate, Number(interval));
}

export type PlanRow = { amountCents: number; dueDate: string };

/** Gera parcelas: centavos de sobra nas primeiras; datas pelo intervalo (anchorDay: dia fixo do mês no mensal). */
export function generatePlan(
  baseCents: number,
  count: number,
  firstDue: string,
  interval: IntervalKey,
  anchorDay?: number,
): PlanRow[] {
  const amounts = splitCents(Math.max(0, baseCents), count);
  return amounts.map((amountCents, i) => ({ amountCents, dueDate: dueDateFor(firstDue, i, interval, anchorDay) }));
}
