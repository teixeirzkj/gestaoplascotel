import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { addDays, todayISO } from "@/lib/dates";
import { num } from "@/lib/money";
import type {
  ActivityView,
  CustomerFinancialStatus,
  CustomerView,
  DashboardSummary,
  InstallmentView,
  PaymentView,
  PromiseView,
} from "@/types/database";

/** Indicadores do dashboard (deduplicado por requisição: KPIs e resumo financeiro compartilham a chamada). */
export const getDashboardSummary = cache(async (): Promise<DashboardSummary> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_summary");
  if (error) throw error;
  const raw = (data ?? {}) as Record<string, unknown>;
  return {
    today: typeof raw.today === "string" ? raw.today : todayISO(),
    total_receivable: num(raw.total_receivable),
    overdue_amount: num(raw.overdue_amount),
    overdue_count: num(raw.overdue_count),
    overdue_customers: num(raw.overdue_customers),
    received_today: num(raw.received_today),
    received_today_count: num(raw.received_today_count),
    due_today_amount: num(raw.due_today_amount),
    due_today_count: num(raw.due_today_count),
    active_customers: num(raw.active_customers),
    customers_with_balance: num(raw.customers_with_balance),
    pending_confirmations: num(raw.pending_confirmations),
    broken_promises: num(raw.broken_promises),
    sold_month: num(raw.sold_month),
    received_month: num(raw.received_month),
  };
});

export type MonthlyPoint = { month: string; sold: number; received: number; due: number };

export async function getMonthlySeries(months = 6): Promise<MonthlyPoint[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("monthly_series", { p_months: months });
  if (error) throw error;
  return (data ?? []).map((r) => ({ month: r.month, sold: num(r.sold), received: num(r.received), due: num(r.due) }));
}

/* -------------------------------------------------------------------------- */
/* Atenção hoje                                                                */
/* -------------------------------------------------------------------------- */

export type AttentionReasonTone = "danger" | "warning" | "info" | "brand";
export type AttentionReason = { label: string; tone: AttentionReasonTone };

export type AttentionItem = {
  customerId: string;
  customerName: string;
  cityName: string | null;
  phone: string | null;
  whatsapp: string | null;
  financialStatus: CustomerFinancialStatus | null;
  pendingAmount: number;
  agreedDate: string | null;
  reasons: AttentionReason[];
  /** Parcela mais urgente (para a ação rápida "Receber") */
  installment: InstallmentView | null;
  hasPendingConfirmation: boolean;
  priority: number;
};

export type AttentionResult = { items: AttentionItem[]; total: number };

type Acc = {
  installments: InstallmentView[];
  promises: PromiseView[];
  payments: PaymentView[];
};

/** Ordena da parcela mais urgente para a menos urgente. */
function compareUrgency(a: InstallmentView, b: InstallmentView): number {
  const rank = (i: InstallmentView) => (i.status === "overdue" ? 0 : i.status === "due_today" ? 1 : 2);
  return rank(a) - rank(b) || b.days_overdue - a.days_overdue || a.collection_date.localeCompare(b.collection_date) || num(b.remaining) - num(a.remaining);
}

/** Tamanho do bloco de leitura: igual ao max-rows padrão do PostgREST. */
const PAGE_SIZE = 1000;
/** Trava de segurança contra laço infinito (100 mil linhas por consulta). */
const MAX_PAGES = 100;
/** Quantidade de UUIDs por filtro `in.(...)`, para a URL não estourar o limite do servidor. */
const IN_CHUNK = 150;

/** Resposta de uma página do PostgREST; as linhas das views são convertidas para os aliases de domínio. */
type PageResult = { data: unknown[] | null; error: unknown };

/**
 * Lê todas as linhas de uma consulta em blocos de {@link PAGE_SIZE} com `.range()`.
 * A consulta deve ter ordenação estável (terminando numa coluna única, como `id`).
 */
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<PageResult>): Promise<T[]> {
  const out: T[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE;
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return out;
}

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/**
 * Clientes que precisam de ação hoje, agrupados e ordenados por urgência.
 * Lê TODAS as parcelas/promessas/pagamentos que se encaixam (sem truncar por linha), então `total`,
 * motivos e valores são exatos. `limit` corta só a lista devolvida; sem ele, devolve todos os clientes.
 */
export async function getAttentionToday(limit?: number): Promise<AttentionResult> {
  const supabase = await createClient();
  const today = todayISO();
  const soon = addDays(today, 3);

  const [installments, promises, payments] = await Promise.all([
    fetchAll<InstallmentView>((from, to) =>
      supabase
        .from("v_installments")
        .select("*")
        .or(`status.in.(due_today,overdue),and(needs_visit.eq.true,status.in.(upcoming,postponed),collection_date.lte.${soon})`)
        .eq("customer_archived", false)
        .order("collection_date", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    ),
    fetchAll<PromiseView>((from, to) =>
      supabase
        .from("v_promises")
        .select("*")
        .or(`effective_status.eq.broken,and(status.eq.pending,due_date.eq.${today})`)
        .order("due_date", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    ),
    fetchAll<PaymentView>((from, to) =>
      supabase
        .from("v_payments")
        .select("*")
        .eq("status", "pending_confirmation")
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    ),
  ]);

  const byCustomer = new Map<string, Acc>();
  const get = (id: string) => {
    let a = byCustomer.get(id);
    if (!a) {
      a = { installments: [], promises: [], payments: [] };
      byCustomer.set(id, a);
    }
    return a;
  };
  installments.forEach((i) => get(i.customer_id).installments.push(i));
  promises.forEach((p) => get(p.customer_id).promises.push(p));
  payments.forEach((p) => get(p.customer_id).payments.push(p));

  if (byCustomer.size === 0) return { items: [], total: 0 };

  const customerIds = [...byCustomer.keys()];
  const postponedIds = installments.filter((i) => i.is_postponed).map((i) => i.id);

  const [customerChunks, postponementChunks] = await Promise.all([
    Promise.all(
      chunk(customerIds, IN_CHUNK).map(async (ids) => {
        const { data, error } = await supabase
          .from("v_customers")
          .select("id, full_name, phone, whatsapp, city_name, balance, overdue_amount, financial_status, archived_at")
          .in("id", ids);
        if (error) throw error;
        return data ?? [];
      }),
    ),
    Promise.all(
      chunk(postponedIds, IN_CHUNK).map((ids) =>
        fetchAll<{ installment_id: string; reason: string; created_at: string }>((from, to) =>
          supabase
            .from("payment_postponements")
            .select("installment_id, reason, created_at")
            .in("installment_id", ids)
            .order("created_at", { ascending: false })
            .order("id", { ascending: false })
            .range(from, to),
        ),
      ),
    ),
  ]);

  const customers = new Map(customerChunks.flat().map((c) => [c.id as string, c]));
  const lastReason = new Map<string, string>();
  for (const p of postponementChunks.flat()) {
    if (!lastReason.has(p.installment_id)) lastReason.set(p.installment_id, p.reason);
  }

  const items: AttentionItem[] = [];
  for (const [customerId, acc] of byCustomer) {
    const c = customers.get(customerId);
    if (c?.archived_at) continue;

    const sorted = [...acc.installments].sort(compareUrgency);
    const top = sorted[0] ?? null;
    const reasons: AttentionReason[] = [];
    let priority = 0;

    const overdue = sorted.filter((i) => i.status === "overdue");
    if (overdue.length) {
      const maxDays = Math.max(...overdue.map((i) => i.days_overdue));
      reasons.push({
        label: overdue.length > 1 ? `${overdue.length} parcelas atrasadas · até ${maxDays} dias` : `Atrasada há ${maxDays} ${maxDays === 1 ? "dia" : "dias"}`,
        tone: "danger",
      });
      priority = Math.max(priority, 5_000 + maxDays);
    }
    const dueToday = sorted.filter((i) => i.status === "due_today");
    if (dueToday.length) {
      reasons.push({ label: dueToday.length > 1 ? `${dueToday.length} parcelas vencem hoje` : "Vence hoje", tone: "warning" });
      priority = Math.max(priority, 4_000);
    }
    const postponedReason = sorted.map((i) => (i.is_postponed ? lastReason.get(i.id) : undefined)).find(Boolean);
    if (postponedReason) reasons.push({ label: `Adiado: ${postponedReason}`, tone: "info" });

    const brokenPromises = acc.promises.filter((p) => p.effective_status === "broken");
    if (brokenPromises.length) {
      reasons.push({ label: "Promessa não cumprida", tone: "danger" });
      priority = Math.max(priority, 3_500);
    }
    const promiseToday = acc.promises.find((p) => p.status === "pending" && p.due_date === today);
    if (promiseToday) {
      reasons.push({ label: "Promessa para hoje", tone: "warning" });
      priority = Math.max(priority, 3_000);
    }
    if (acc.payments.length) {
      reasons.push({
        label: acc.payments.length > 1 ? `${acc.payments.length} pagamentos a confirmar` : "Pagamento a confirmar",
        tone: "brand",
      });
      priority = Math.max(priority, 2_000);
    }
    if (sorted.some((i) => i.needs_visit)) {
      reasons.push({ label: "Pediu visita presencial", tone: "info" });
      priority = Math.max(priority, 1_000);
    }

    const instAmount = sorted.reduce((s, i) => s + num(i.remaining), 0);
    const promiseAmount = acc.promises.reduce((s, p) => s + num(p.amount), 0);
    const pendingAmount = instAmount > 0 ? instAmount : promiseAmount > 0 ? promiseAmount : num(c?.balance);

    const agreedDate = top?.collection_date ?? promiseToday?.due_date ?? brokenPromises[0]?.due_date ?? null;

    items.push({
      customerId,
      customerName: (c?.full_name as string | undefined) ?? top?.customer_name ?? acc.promises[0]?.customer_name ?? acc.payments[0]?.customer_name ?? "Cliente",
      cityName: (c?.city_name as string | null | undefined) ?? top?.city_name ?? null,
      phone: (c?.phone as string | null | undefined) ?? top?.customer_phone ?? null,
      whatsapp: (c?.whatsapp as string | null | undefined) ?? top?.customer_whatsapp ?? null,
      financialStatus: (c?.financial_status as CustomerFinancialStatus | null | undefined) ?? null,
      pendingAmount,
      agreedDate,
      reasons,
      installment: top && num(top.remaining) > 0 ? top : null,
      hasPendingConfirmation: acc.payments.length > 0,
      priority: priority * 1_000_000_000 + Math.round(pendingAmount * 100),
    });
  }

  items.sort((a, b) => b.priority - a.priority);
  return { items: limit === undefined ? items : items.slice(0, limit), total: items.length };
}

/* -------------------------------------------------------------------------- */
/* Listas laterais                                                             */
/* -------------------------------------------------------------------------- */

export async function getRecentActivity(limit = 8): Promise<ActivityView[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("v_activity").select("*").order("occurred_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []) as ActivityView[];
}

export async function getUpcomingInstallments(limit = 6): Promise<InstallmentView[]> {
  const supabase = await createClient();
  const today = todayISO();
  const { data, error } = await supabase
    .from("v_installments")
    .select("*")
    .in("status", ["upcoming", "postponed"])
    .gt("collection_date", today)
    .lte("collection_date", addDays(today, 7))
    .eq("customer_archived", false)
    .order("collection_date", { ascending: true })
    .order("remaining", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as InstallmentView[];
}

export async function getCustomersNeedingAttention(limit = 6): Promise<CustomerView[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_customers")
    .select("*")
    .in("financial_status", ["overdue", "pending"])
    .is("archived_at", null)
    .order("overdue_amount", { ascending: false })
    .order("balance", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as CustomerView[];
}

export type UpcomingVisit = {
  id: string;
  visit_date: string;
  visit_time: string | null;
  notes: string | null;
  city_name: string;
  customers_count: number;
};

export async function getUpcomingVisits(limit = 4): Promise<UpcomingVisit[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("visits")
    .select("id, visit_date, visit_time, notes, cities(name), visit_customers(count)")
    .eq("status", "planned")
    .gte("visit_date", todayISO())
    .order("visit_date", { ascending: true })
    .order("visit_time", { ascending: true, nullsFirst: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((v) => {
    const city = v.cities as { name: string } | { name: string }[] | null;
    const vc = v.visit_customers as { count: number }[] | null;
    return {
      id: v.id,
      visit_date: v.visit_date,
      visit_time: v.visit_time,
      notes: v.notes,
      city_name: (Array.isArray(city) ? city[0]?.name : city?.name) ?? "Cidade",
      customers_count: vc?.[0]?.count ?? 0,
    };
  });
}
