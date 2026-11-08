import "server-only";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/dates";
import { num } from "@/lib/money";
import type { InstallmentView, PaymentView } from "@/types/database";
import { COLLECTION_TABS, type CollectionSort, type CollectionTab } from "./tabs";

export const COLLECTIONS_PAGE_SIZE = 25;

type Clause = { kind: "filter"; col: string; op: string; val: string } | { kind: "or"; expr: string };

type Filterable<Q> = {
  filter(column: string, operator: string, value: unknown): Q;
  or(filters: string): Q;
};

function applyClauses<Q extends Filterable<Q>>(query: Q, clauses: Clause[]): Q {
  let q = query;
  for (const c of clauses) q = c.kind === "or" ? q.or(c.expr) : q.filter(c.col, c.op, c.val);
  return q;
}

/** Remove caracteres com significado na sintaxe de filtros do PostgREST. */
function sanitizeSearch(input: string): string {
  return input.replace(/[,()"\\*%:]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

function searchClause(q: string | undefined, withPhone: boolean): Clause[] {
  const s = sanitizeSearch(q ?? "");
  if (!s) return [];
  const parts = [`customer_name.ilike."%${s}%"`];
  const digits = s.replace(/\D/g, "");
  if (withPhone && digits.length >= 4) {
    // Telefones podem estar salvos com máscara: casa os dígitos em sequência, ignorando separadores.
    const pattern = `%${digits.split("").join("%")}%`;
    parts.push(`customer_phone.ilike."${pattern}"`, `customer_whatsapp.ilike."${pattern}"`);
  }
  return [{ kind: "or", expr: parts.join(",") }];
}

type InstallmentTab = Exclude<CollectionTab, "confirmar">;

function tabClauses(tab: InstallmentTab, today: string): Clause[] {
  switch (tab) {
    case "hoje":
      return [{ kind: "filter", col: "status", op: "eq", val: "due_today" }];
    case "proximas":
      return [
        { kind: "filter", col: "status", op: "in", val: "(upcoming,postponed)" },
        { kind: "filter", col: "collection_date", op: "gt", val: today },
      ];
    case "atrasadas":
      return [{ kind: "filter", col: "status", op: "eq", val: "overdue" }];
    case "adiadas":
      // Inclui adiamentos vencidos (nova data passou sem pagamento): é o caso que mais importa acompanhar.
      return [
        { kind: "filter", col: "is_postponed", op: "eq", val: "true" },
        { kind: "filter", col: "status", op: "not.in", val: "(paid,cancelled)" },
      ];
    case "pagas":
      return [{ kind: "filter", col: "status", op: "eq", val: "paid" }];
    case "todas":
    default:
      return [{ kind: "filter", col: "status", op: "not.in", val: "(paid,cancelled)" }];
  }
}

export type CollectionFilters = {
  q?: string;
  cityId?: string;
};

function installmentFilterClauses(f: CollectionFilters): Clause[] {
  const out = searchClause(f.q, true);
  if (f.cityId) out.push({ kind: "filter", col: "city_id", op: "eq", val: f.cityId });
  return out;
}

/** Filtros de v_payments: a cidade é a do cliente do pagamento (`v_payments.city_id`), pelo id. */
function paymentFilterClauses(f: CollectionFilters): Clause[] {
  const out = searchClause(f.q, false);
  if (f.cityId) out.push({ kind: "filter", col: "city_id", op: "eq", val: f.cityId });
  return out;
}

export type CollectionOverview = {
  /** Contagem de cada aba (respeita busca e cidade). */
  counts: Record<CollectionTab, number>;
  /** Soma de cada aba: saldo restante; valor das parcelas em "Pagas"; valor aguardando em "A confirmar". */
  sums: Record<CollectionTab, number>;
};

/**
 * Contagem e soma de todas as abas numa única chamada à RPC `collections_overview`
 * (security invoker; mesmos filtros de busca e cidade das listagens abaixo).
 */
export async function getCollectionOverview(f: CollectionFilters): Promise<CollectionOverview> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("collections_overview", {
    ...(f.q ? { p_q: f.q } : {}),
    ...(f.cityId ? { p_city: f.cityId } : {}),
  });
  if (error) throw error;

  const raw = (data && typeof data === "object" && !Array.isArray(data) ? data : {}) as Record<string, unknown>;
  const counts = {} as Record<CollectionTab, number>;
  const sums = {} as Record<CollectionTab, number>;
  for (const { value } of COLLECTION_TABS) {
    const entry = (raw[value] ?? {}) as { count?: unknown; sum?: unknown };
    counts[value] = num(entry.count);
    sums[value] = num(entry.sum);
  }
  return { counts, sums };
}

export type InstallmentPage = { rows: InstallmentView[]; total: number };

/** Lista paginada de parcelas para uma aba (a soma da aba vem de getCollectionOverview). */
export async function listCollectionInstallments(opts: {
  tab: InstallmentTab;
  filters: CollectionFilters;
  sort: CollectionSort;
  page: number;
  pageSize?: number;
}): Promise<InstallmentPage> {
  const supabase = await createClient();
  const today = todayISO();
  const pageSize = opts.pageSize ?? COLLECTIONS_PAGE_SIZE;
  const clauses = [...tabClauses(opts.tab, today), ...installmentFilterClauses(opts.filters)];
  const paidTab = opts.tab === "pagas";

  let list = applyClauses(supabase.from("v_installments").select("*", { count: "exact" }), clauses);
  if (opts.sort === "valor") {
    list = list.order(paidTab ? "amount" : "remaining", { ascending: false });
  } else if (opts.sort === "atraso") {
    list = list.order("days_overdue", { ascending: false }).order("collection_date", { ascending: true });
  } else if (paidTab) {
    list = list.order("paid_at", { ascending: false, nullsFirst: false });
  } else {
    list = list.order("collection_date", { ascending: true });
  }
  list = list.order("customer_name", { ascending: true }).order("id", { ascending: true });

  const from = (opts.page - 1) * pageSize;
  const { data, count, error } = await list.range(from, from + pageSize - 1);
  if (error) throw error;
  return { rows: (data ?? []) as InstallmentView[], total: count ?? 0 };
}

export type PaymentPage = { rows: PaymentView[]; total: number };

/** Pagamentos aguardando confirmação (mais antigos primeiro). A soma vem de getCollectionOverview. */
export async function listPendingConfirmationPayments(opts: {
  filters: CollectionFilters;
  sort?: CollectionSort;
  page: number;
  pageSize?: number;
}): Promise<PaymentPage> {
  const supabase = await createClient();
  const pageSize = opts.pageSize ?? COLLECTIONS_PAGE_SIZE;
  let list = applyClauses(
    supabase.from("v_payments").select("*", { count: "exact" }).eq("status", "pending_confirmation"),
    paymentFilterClauses(opts.filters),
  );
  list = opts.sort === "valor" ? list.order("amount", { ascending: false }) : list.order("created_at", { ascending: true });
  const from = (opts.page - 1) * pageSize;
  const { data, count, error } = await list.order("id").range(from, from + pageSize - 1);
  if (error) throw error;
  return { rows: (data ?? []) as PaymentView[], total: count ?? 0 };
}

/** Cidades ativas para o filtro. */
export async function getCityOptions(): Promise<{ value: string; label: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("cities").select("id, name, state").eq("archived", false).order("name");
  if (error) throw error;
  return (data ?? []).map((c) => ({ value: c.id, label: c.state && c.state !== "BA" ? `${c.name} - ${c.state}` : c.name }));
}

/** Parcelas em aberto de um cliente (para promessas e resumos em outras telas). */
export async function getOpenInstallmentsForCustomer(customerId: string): Promise<InstallmentView[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_installments")
    .select("*")
    .eq("customer_id", customerId)
    .not("status", "in", "(paid,cancelled)")
    .order("collection_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as InstallmentView[];
}

/** Uma parcela pela id (null se não existir). */
export async function getInstallment(id: string): Promise<InstallmentView | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("v_installments").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as InstallmentView | null) ?? null;
}
