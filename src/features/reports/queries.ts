import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isISODate, periodRange, PERIOD_OPTIONS, type PeriodKey } from "@/lib/dates";
import { num } from "@/lib/money";
import type { CashMovementView, ReportSummary } from "@/types/database";
import type { AgingRow, CityRow, MonthPoint, OverdueRow, SaleExportRow } from "./shared";

export type { AgingRow, CityRow, MonthPoint, OverdueRow, SaleExportRow };

export class ReportError extends Error {}

/** Resultado acima do teto de exportação (o arquivo sairia parcial). */
export class ReportTooLargeError extends ReportError {}

export type Period = { key: PeriodKey; from: string; to: string };

/** Lê ?periodo=&de=&ate= com valores seguros (padrão: este mês). */
export function resolvePeriod(sp: { periodo?: string | string[]; de?: string | string[]; ate?: string | string[] }): Period {
  const raw = typeof sp.periodo === "string" ? sp.periodo : "";
  const key = (PERIOD_OPTIONS.some((o) => o.value === raw) ? raw : "month") as PeriodKey;
  const de = typeof sp.de === "string" && isISODate(sp.de) ? sp.de : undefined;
  const ate = typeof sp.ate === "string" && isISODate(sp.ate) ? sp.ate : undefined;
  const r = periodRange(key, { from: de, to: ate });
  return r.from <= r.to ? { key, ...r } : { key, from: r.to, to: r.from };
}

type Page<T> = (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>;

const TOO_LARGE = "Período grande demais para exportar; reduza o intervalo.";

/** Teto das exportações; acima disso recusa em vez de gerar um arquivo parcial. */
const EXPORT_MAX_ROWS = 200_000;

/**
 * Busca paginada (o PostgREST limita cada resposta a 1000 linhas).
 * Ao chegar em `max` linhas: com `strict` lança ReportError (nunca devolve um resultado
 * parcial que pareça completo); sem `strict` devolve as `max` primeiras e quem chama sinaliza o corte.
 */
async function fetchAll<T>(page: Page<T>, { max, strict }: { max: number; strict: boolean }): Promise<T[]> {
  const size = 1000;
  const out: T[] = [];
  while (out.length < max) {
    const from = out.length;
    const want = Math.min(size, max - from);
    const { data, error } = await page(from, from + want - 1);
    if (error) throw error;
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < want) return out;
  }
  if (strict) {
    // Chegou exatamente em `max`: só recusa se existir mais alguma linha.
    const { data, error } = await page(max, max);
    if (error) throw error;
    if ((data ?? []).length > 0) throw new ReportTooLargeError(TOO_LARGE);
  }
  return out;
}

/** Repassa ReportError (mensagem específica) e troca qualquer outro erro pela mensagem genérica. */
function rethrow(e: unknown, fallback: string): never {
  if (e instanceof ReportError) throw e;
  throw new ReportError(fallback);
}

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export async function getReportSummary(from: string, to: string): Promise<ReportSummary> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("report_summary", { p_from: from, p_to: to });
  if (error) throw new ReportError("Não foi possível carregar os indicadores do período.");
  const s = obj(data);
  const m = obj(s.received_by_method);
  return {
    from,
    to,
    total_sold: num(s.total_sold),
    sales_count: num(s.sales_count),
    paid_sales_count: num(s.paid_sales_count),
    total_received: num(s.total_received),
    received_by_method: { pix: num(m.pix), cash: num(m.cash), transfer: num(m.transfer), other: num(m.other) },
    total_pending: num(s.total_pending),
    total_overdue: num(s.total_overdue),
    delinquent_customers: num(s.delinquent_customers),
  };
}

export async function getMonthlySeries(months = 12): Promise<MonthPoint[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("monthly_series", { p_months: months });
  if (error) throw new ReportError("Não foi possível carregar a evolução mensal.");
  return (data ?? []).map((r) => ({ month: r.month, sold: num(r.sold), received: num(r.received), due: num(r.due) }));
}

export async function getReportByCity(from: string, to: string): Promise<CityRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("report_by_city", { p_from: from, p_to: to });
  if (error) throw new ReportError("Não foi possível carregar o relatório por cidade.");
  // O tipo gerado declara city_id/state como não nulos, mas a linha "Sem cidade" vem com ambos nulos.
  return (data ?? []).map((r) => {
    const cityId = (r.city_id as string | null) ?? null;
    return {
      city_id: cityId,
      city_name: r.city_name || "Sem cidade",
      state: (r.state as string | null) || null,
      total_sold: num(r.total_sold),
      total_received: num(r.total_received),
      total_pending: num(r.total_pending),
      total_overdue: num(r.total_overdue),
      customers_count: num(r.customers_count),
      overdue_customers: num(r.overdue_customers),
    };
  });
}

export async function getDelinquencyAging(): Promise<AgingRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delinquency_aging");
  if (error) throw new ReportError("Não foi possível carregar o painel de inadimplência.");
  return (data ?? []).map((r) => ({
    bucket: r.bucket,
    sort_order: num(r.sort_order),
    amount: num(r.amount),
    installments_count: num(r.installments_count),
    customers_count: num(r.customers_count),
  }));
}

/**
 * Parcelas em atraso (v_installments status = overdue), mais atrasadas primeiro.
 * `strict` (exportação): lança ReportError se houver mais de `max`; sem ele devolve as `max` primeiras.
 */
export async function getOverdueInstallments(
  max = 5000,
  { strict = false }: { strict?: boolean } = {},
): Promise<OverdueRow[]> {
  const supabase = await createClient();
  try {
    const rows = await fetchAll(
      (a, b) =>
        supabase
          .from("v_installments")
          .select(
            "id, customer_id, customer_name, customer_phone, customer_whatsapp, city_name, sale_id, sale_code, number, remaining, original_due_date, collection_date, days_overdue",
          )
          .eq("status", "overdue")
          .order("days_overdue", { ascending: false })
          .order("id")
          .range(a, b),
      { max, strict },
    );
    return rows.map((r) => ({
      id: String(r.id),
      customer_id: String(r.customer_id),
      customer_name: r.customer_name ?? "—",
      customer_phone: r.customer_phone,
      customer_whatsapp: r.customer_whatsapp,
      city_name: r.city_name,
      sale_id: String(r.sale_id),
      sale_code: num(r.sale_code),
      number: num(r.number),
      remaining: num(r.remaining),
      original_due_date: String(r.original_due_date),
      collection_date: String(r.collection_date),
      days_overdue: num(r.days_overdue),
    }));
  } catch (e) {
    rethrow(e, "Não foi possível carregar as parcelas em atraso.");
  }
}

export async function getCashMovementsInRange(from: string, to: string): Promise<CashMovementView[]> {
  const supabase = await createClient();
  try {
    const rows = await fetchAll(
      (a, b) =>
        supabase
          .from("v_cash_movements")
          .select("*")
          .gte("occurred_on", from)
          .lte("occurred_on", to)
          .order("occurred_on")
          .order("created_at")
          .order("id")
          .range(a, b),
      { max: EXPORT_MAX_ROWS, strict: true },
    );
    return rows as CashMovementView[];
  } catch (e) {
    rethrow(e, "Não foi possível carregar as movimentações do caixa.");
  }
}

export async function getSalesInRange(from: string, to: string): Promise<SaleExportRow[]> {
  const supabase = await createClient();
  try {
    const rows = await fetchAll(
      (a, b) =>
        supabase
          .from("v_sales")
          .select("code, sale_date, customer_name, city_name, status, total, paid_total, balance, installments_count")
          .gte("sale_date", from)
          .lte("sale_date", to)
          .order("sale_date")
          .order("code")
          .range(a, b),
      { max: EXPORT_MAX_ROWS, strict: true },
    );
    return rows.map((r) => ({
      code: num(r.code),
      sale_date: String(r.sale_date),
      customer_name: r.customer_name ?? "—",
      city_name: r.city_name,
      status: String(r.status),
      total: num(r.total),
      paid_total: num(r.paid_total),
      balance: num(r.balance),
      installments_count: num(r.installments_count),
    }));
  } catch (e) {
    rethrow(e, "Não foi possível carregar as vendas do período.");
  }
}
