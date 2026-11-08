/** Tipos e regras compartilhados entre servidor e cliente (sem dependências de servidor). */
export type MonthPoint = { month: string; sold: number; received: number; due: number };
/** Linha de report_by_city. `city_id` nulo = linha agregada "Sem cidade" (clientes sem cidade ou com cidade arquivada). */
export type CityRow = {
  city_id: string | null;
  city_name: string;
  state: string | null;
  total_sold: number;
  total_received: number;
  total_pending: number;
  total_overdue: number;
  customers_count: number;
  overdue_customers: number;
};
/** Key estável para listas (a linha "Sem cidade" não tem id). */
export const cityRowKey = (r: Pick<CityRow, "city_id">): string => r.city_id ?? "sem-cidade";
export type AgingRow = { bucket: string; sort_order: number; amount: number; installments_count: number; customers_count: number };
export type OverdueRow = {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string | null;
  customer_whatsapp: string | null;
  city_name: string | null;
  sale_id: string;
  sale_code: number;
  number: number;
  remaining: number;
  original_due_date: string;
  collection_date: string;
  days_overdue: number;
};
export type SaleExportRow = {
  code: number;
  sale_date: string;
  customer_name: string;
  city_name: string | null;
  status: string;
  total: number;
  paid_total: number;
  balance: number;
  installments_count: number;
};

/** Faixas do banco (delinquency_aging usa greatest(days_overdue, 1)). */
export const AGING_RANGES: Record<number, [number, number]> = { 1: [1, 7], 2: [8, 15], 3: [16, 30], 4: [31, Number.POSITIVE_INFINITY] };

export function agingOrder(daysOverdue: number): number {
  const d = Math.max(daysOverdue, 1);
  for (const [k, [lo, hi]] of Object.entries(AGING_RANGES)) if (d >= lo && d <= hi) return Number(k);
  return 4;
}
