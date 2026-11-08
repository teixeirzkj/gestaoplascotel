import "server-only";
import { createClient } from "@/lib/supabase/server";
import { addDays } from "@/lib/dates";
import { num } from "@/lib/money";
import type { CashClosing, CashDaySummary, CashMovementView } from "@/types/database";

export type ClosingWithUser = CashClosing & { closed_by_name: string | null };
export type DayTotal = { date: string; total: number; count: number };

export class QueryError extends Error {}

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function str(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function toClosing(v: unknown): CashClosing | null {
  if (!v || typeof v !== "object") return null;
  const c = obj(v);
  return {
    id: String(c.id),
    closing_date: String(c.closing_date),
    expected_total: num(c.expected_total),
    expected_pix: num(c.expected_pix),
    expected_cash: num(c.expected_cash),
    expected_transfer: num(c.expected_transfer),
    expected_other: num(c.expected_other),
    counted_cash: c.counted_cash === null || c.counted_cash === undefined ? null : num(c.counted_cash),
    divergence: num(c.divergence),
    notes: str(c.notes),
    closed_by: str(c.closed_by),
    created_at: String(c.created_at),
  };
}

type Closer = { full_name: string | null; email: string | null } | null;

function closerName(c: Closer): string | null {
  return c?.full_name || c?.email || null;
}

/**
 * Resumo do caixa do dia (RPC cash_day_summary) + nome de quem conferiu.
 * O nome vem de uma consulta paralela (embed em profiles), sem ida extra em série.
 */
export async function getCashDay(date: string): Promise<CashDaySummary & { closing: ClosingWithUser | null }> {
  const supabase = await createClient();
  const [summary, closer] = await Promise.all([
    supabase.rpc("cash_day_summary", { p_date: date }),
    supabase.from("cash_closings").select("closed_by, closer:profiles(full_name, email)").eq("closing_date", date).maybeSingle(),
  ]);
  if (summary.error) throw new QueryError("Não foi possível carregar o resumo do caixa.");
  const s = obj(summary.data);
  const closing = toClosing(s.closing);
  // Se a busca do nome falhar, o resumo continua; só fica sem o nome.
  const closedByName =
    closing?.closed_by && closer.data?.closed_by === closing.closed_by ? closerName(closer.data.closer) : null;
  const byUser = Array.isArray(s.by_user) ? s.by_user : [];
  return {
    date,
    total: num(s.total),
    pix: num(s.pix),
    cash: num(s.cash),
    transfer: num(s.transfer),
    other: num(s.other),
    payments_count: num(s.payments_count),
    payments_total: num(s.payments_total),
    reversals_total: num(s.reversals_total),
    adjustments_total: num(s.adjustments_total),
    by_user: byUser.map((u) => {
      const r = obj(u);
      return { user_id: str(r.user_id), name: str(r.name), total: num(r.total), count: num(r.count) };
    }),
    closing: closing ? { ...closing, closed_by_name: closedByName } : null,
  };
}

/** Movimentações de caixa de um dia, em ordem cronológica. */
export async function getCashMovements(date: string): Promise<CashMovementView[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_cash_movements")
    .select("*")
    .eq("occurred_on", date)
    .order("created_at", { ascending: true })
    .limit(1000);
  if (error) throw new QueryError("Não foi possível carregar as movimentações do dia.");
  return (data ?? []) as CashMovementView[];
}

/** Últimas conferências de caixa. */
export async function getRecentClosings(limit = 30): Promise<ClosingWithUser[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cash_closings")
    .select("*, closer:profiles(full_name, email)")
    .order("closing_date", { ascending: false })
    .limit(limit);
  if (error) throw new QueryError("Não foi possível carregar o histórico de conferências.");
  return (data ?? []).flatMap((r) => {
    const c = toClosing(r);
    return c ? [{ ...c, closed_by_name: closerName(r.closer) }] : [];
  });
}

/** Total movimentado por dia nos `days` dias que terminam em `endDate` (para o mini gráfico). */
export async function getDailyTotals(endDate: string, days = 7): Promise<DayTotal[]> {
  const start = addDays(endDate, -(days - 1));
  const supabase = await createClient();
  const out: DayTotal[] = Array.from({ length: days }, (_, i) => ({ date: addDays(start, i), total: 0, count: 0 }));
  const idx = new Map(out.map((d, i) => [d.date, i]));
  // O PostgREST devolve no máximo 1000 linhas por resposta: pagina até a última página.
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await supabase
      .from("cash_movements")
      .select("occurred_on, amount, kind")
      .gte("occurred_on", start)
      .lte("occurred_on", endDate)
      .order("occurred_on")
      .order("id")
      .range(from, from + size - 1);
    if (error) throw new QueryError("Não foi possível carregar os últimos dias.");
    const rows = data ?? [];
    for (const m of rows) {
      const i = idx.get(m.occurred_on);
      if (i === undefined) continue;
      out[i].total = Math.round((out[i].total + num(m.amount)) * 100) / 100;
      if (m.kind === "payment") out[i].count += 1;
    }
    if (rows.length < size) break;
  }
  return out;
}
