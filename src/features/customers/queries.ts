import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { num } from "@/lib/money";
import type {
  ActivityView,
  City,
  CustomerView,
  InstallmentView,
  PaymentView,
  PromiseView,
  SaleView,
} from "@/types/database";
import { ACTIVITY_PAGE_SIZE, isUuid, onlyDigits, PAGE_SIZE, type CustomerListParams } from "./schemas";
import type { CityOption, CustomerNoteItem, PostponementItem } from "./types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Remove caracteres com significado especial no filtro `or` do PostgREST. */
function sanitizeTerm(q: string) {
  return q.replace(/[,()*%\\"':]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Aplica os filtros da listagem a uma consulta de v_customers.
 * Telefone: busca por dígitos em phone/whatsapp; nome: ilike.
 */
function applyFilters<Q extends { or: (f: string) => Q; eq: (c: string, v: string) => Q; is: (c: string, v: null) => Q }>(
  query: Q,
  p: CustomerListParams,
): Q {
  let q = query;
  const term = sanitizeTerm(p.q);
  if (term) {
    const digits = onlyDigits(term);
    const hasLetters = /\p{L}/u.test(term);
    const parts: string[] = [];
    if (hasLetters || digits.length === 0) parts.push(`full_name.ilike.%${term}%`);
    if (digits.length >= 2) parts.push(`phone.ilike.%${digits}%`, `whatsapp.ilike.%${digits}%`);
    if (parts.length) q = q.or(parts.join(","));
  }
  if (p.cityId) q = q.eq("city_id", p.cityId);
  if (p.status) q = q.eq("financial_status", p.status);
  if (!p.archived) q = q.is("archived_at", null);
  return q;
}

export async function listCustomers(p: CustomerListParams) {
  const supabase = await createClient();
  const from = (p.page - 1) * PAGE_SIZE;

  let query = supabase.from("v_customers").select("*", { count: "exact" });
  query = applyFilters(query, p);
  switch (p.sort) {
    case "saldo":
      query = query.order("balance", { ascending: false }).order("full_name");
      break;
    case "atraso":
      query = query.order("overdue_amount", { ascending: false }).order("next_collection_date", { ascending: true, nullsFirst: false });
      break;
    case "recentes":
      query = query.order("created_at", { ascending: false });
      break;
    default:
      query = query.order("full_name");
  }
  // Página e soma do saldo são independentes: em paralelo, sem ida extra em cascata.
  const [{ data, count, error }, openTotal] = await Promise.all([
    query.range(from, from + PAGE_SIZE - 1),
    sumOpenBalance(supabase, p),
  ]);
  if (error) throw error;

  return { rows: (data ?? []) as CustomerView[], total: count ?? 0, openTotal };
}

/**
 * Saldo em aberto de TODOS os clientes filtrados (não só a página), numa só chamada.
 * A RPC `customers_open_balance` repete no banco o `sanitizeTerm` e o `applyFilters` acima
 * (mesma busca, cidade, situação financeira e arquivados), somando só saldos > 0.
 */
async function sumOpenBalance(supabase: Supabase, p: CustomerListParams): Promise<number> {
  const { data, error } = await supabase.rpc("customers_open_balance", {
    p_q: p.q || undefined,
    p_city: p.cityId ?? undefined,
    p_status: p.status ?? undefined,
    p_archived: p.archived,
  });
  if (error) throw error;
  return num((data as { balance?: number | string | null } | null)?.balance);
}

export async function listActiveCities(): Promise<CityOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("cities").select("id, name, state").eq("archived", false).order("name");
  if (error) throw error;
  return (data ?? []) as CityOption[];
}

/** Deduplicado por requisição (metadata + página). */
export const getCustomer = cache(async (id: string): Promise<CustomerView | null> => {
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("v_customers").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as CustomerView | null) ?? null;
});

/** Cidade do cliente mesmo que arquivada (para manter no select de edição). */
export async function getCity(id: string | null): Promise<CityOption | null> {
  if (!id) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("cities").select("id, name, state").eq("id", id).maybeSingle();
  return (data as Pick<City, "id" | "name" | "state"> | null) ?? null;
}

/** Deduplicado por requisição. */
export const getOpenInstallments = cache(async (customerId: string): Promise<InstallmentView[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_installments")
    .select("*")
    .eq("customer_id", customerId)
    .not("status", "in", "(paid,cancelled)")
    .order("collection_date")
    .order("number");
  if (error) throw error;
  return (data ?? []) as InstallmentView[];
});

export async function getAllInstallments(customerId: string): Promise<InstallmentView[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_installments")
    .select("*")
    .eq("customer_id", customerId)
    .order("sale_code", { ascending: false })
    .order("number");
  if (error) throw error;
  return (data ?? []) as InstallmentView[];
}

export async function getCustomerSales(customerId: string): Promise<SaleView[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_sales")
    .select("*")
    .eq("customer_id", customerId)
    .order("sale_date", { ascending: false })
    .order("code", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SaleView[];
}

export async function getCustomerPayments(customerId: string): Promise<PaymentView[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_payments")
    .select("*")
    .eq("customer_id", customerId)
    .order("paid_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PaymentView[];
}

export async function getCustomerPromises(customerId: string, onlyPending = false): Promise<PromiseView[]> {
  const supabase = await createClient();
  let q = supabase.from("v_promises").select("*").eq("customer_id", customerId);
  if (onlyPending) q = q.eq("status", "pending");
  const { data, error } = await q.order("due_date", { ascending: onlyPending }).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PromiseView[];
}

export async function getCustomerPostponements(customerId: string): Promise<PostponementItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payment_postponements")
    .select("id, installment_id, previous_date, new_date, reason, notes, expected_channel, needs_visit, created_at, author:profiles!payment_postponements_created_by_fkey(full_name)")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    installment_id: r.installment_id,
    previous_date: r.previous_date,
    new_date: r.new_date,
    reason: r.reason,
    notes: r.notes,
    expected_channel: r.expected_channel,
    needs_visit: r.needs_visit,
    created_at: r.created_at,
    author_name: r.author?.full_name ?? null,
  }));
}

export async function getCustomerActivity(customerId: string, offset = 0, limit = ACTIVITY_PAGE_SIZE): Promise<ActivityView[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_activity")
    .select("id, occurred_at, action, entity_type, entity_id, summary, actor_name, customer_id")
    .eq("customer_id", customerId)
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return (data ?? []) as ActivityView[];
}

export async function getCustomerNotes(customerId: string): Promise<CustomerNoteItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customer_notes")
    .select("id, kind, body, created_at, author:profiles!customer_notes_created_by_fkey(full_name)")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((n) => ({
    id: n.id,
    kind: n.kind,
    body: n.body,
    created_at: n.created_at,
    author_name: n.author?.full_name ?? null,
  }));
}

export async function countCustomerNotes(customerId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase.from("customer_notes").select("id", { count: "exact", head: true }).eq("customer_id", customerId);
  return count ?? 0;
}
