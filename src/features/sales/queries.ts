import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { num } from "@/lib/money";
import type { City, InstallmentView, PaymentView, SaleItem, SaleStatus, SaleView } from "@/types/database";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

export type SaleListFilters = {
  q?: string;
  status?: SaleStatus;
  cityId?: string;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
};

export type SaleListRow = Pick<
  SaleView,
  | "id" | "code" | "customer_id" | "customer_name" | "city_name" | "sale_date" | "total" | "paid_total" | "balance"
  | "open_installments" | "next_collection_date" | "status" | "installments_count"
>;

const LIST_COLUMNS =
  "id, code, customer_id, customer_name, city_name, sale_date, total, paid_total, balance, open_installments, next_collection_date, status, installments_count";

function likePattern(q: string) {
  return `%${q.replace(/[%_\\]/g, (m) => `\\${m}`).replace(/[,()]/g, " ")}%`;
}

// O builder do PostgREST é genérico demais para tipar aqui; aplicamos filtros por duck typing.
type Filterable<T> = {
  eq(column: string, value: string | number): T;
  ilike(column: string, pattern: string): T;
  gte(column: string, value: string): T;
  lte(column: string, value: string): T;
};

function applyFilters<T extends Filterable<T>>(query: T, f: SaleListFilters): T {
  let q = query;
  const term = f.q?.trim();
  if (term) {
    const code = term.replace(/^#/, "");
    if (/^\d{1,12}$/.test(code)) q = q.eq("code", Number(code));
    else q = q.ilike("customer_name", likePattern(term));
  }
  if (f.status) q = q.eq("status", f.status);
  if (f.cityId) q = q.eq("city_id", f.cityId);
  if (f.from) q = q.gte("sale_date", f.from);
  if (f.to) q = q.lte("sale_date", f.to);
  return q;
}

export type SaleListTotals = { sold: number; balance: number; paid: number; count: number };

/** Retorno jsonb de sales_totals (numeric pode chegar como número ou string). */
type SalesTotalsJson = { count?: number | string; total?: number | string; paid?: number | string; balance?: number | string };

/**
 * Totais do filtro inteiro, sem canceladas, agregados no banco pela RPC sales_totals
 * (mesma busca e filtros de applyFilters: #código/código exato ou nome do cliente, status, cidade da venda, período).
 */
async function sumSaleTotals(supabase: SupabaseServer, f: SaleListFilters): Promise<SaleListTotals> {
  // Filtro "canceladas" + exclusão de canceladas = zero, sem ida ao banco.
  if (f.status === "cancelled") return { sold: 0, balance: 0, paid: 0, count: 0 };

  const { data, error } = await supabase.rpc("sales_totals", {
    p_q: f.q?.trim() || undefined,
    p_status: f.status,
    p_city: f.cityId,
    p_from: f.from,
    p_to: f.to,
  });
  if (error) throw new Error(error.message);
  const t = (data ?? {}) as SalesTotalsJson;
  return { sold: num(t.total), balance: num(t.balance), paid: num(t.paid), count: num(t.count) };
}

export async function listSales(f: SaleListFilters) {
  const supabase = await createClient();
  const from = (f.page - 1) * f.pageSize;

  const pageQuery = applyFilters(supabase.from("v_sales").select(LIST_COLUMNS, { count: "exact" }), f)
    .order("sale_date", { ascending: false })
    .order("code", { ascending: false })
    .range(from, from + f.pageSize - 1);

  const [pageRes, totals] = await Promise.all([pageQuery, sumSaleTotals(supabase, f)]);
  if (pageRes.error) throw new Error(pageRes.error.message);

  return {
    rows: (pageRes.data ?? []) as SaleListRow[],
    total: pageRes.count ?? 0,
    totals,
  };
}

export type CityOption = Pick<City, "id" | "name" | "state">;

export async function listCities(): Promise<CityOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("cities").select("id, name, state").eq("archived", false).order("name").limit(1000);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export type CustomerOption = {
  id: string;
  full_name: string;
  phone: string | null;
  whatsapp: string | null;
  city_id: string | null;
  city_name: string | null;
  balance: number;
};

const CUSTOMER_OPTION_COLUMNS = "id, full_name, phone, whatsapp, city_id, city_name, balance";
/** Máximo de resultados exibidos no seletor de cliente. */
const CUSTOMER_SEARCH_LIMIT = 20;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type CustomerOptionRow = {
  id: string | null;
  full_name: string | null;
  phone: string | null;
  whatsapp: string | null;
  city_id: string | null;
  city_name: string | null;
  balance: number | string | null;
};

function toCustomerOption(c: CustomerOptionRow): CustomerOption {
  return {
    id: c.id as string,
    full_name: c.full_name ?? "",
    phone: c.phone,
    whatsapp: c.whatsapp,
    city_id: c.city_id,
    city_name: c.city_name,
    balance: num(c.balance),
  };
}

/** Escapa curingas do ILIKE (% _ \). Usado com .ilike(), que não passa pela sintaxe de .or(). */
function escapeLike(s: string) {
  return s.replace(/[%_\\]/g, (m) => `\\${m}`);
}

/** Cliente ativo (não arquivado) para pré-selecionar na nova venda (?cliente=<id>). */
export async function getCustomerOption(id: string): Promise<CustomerOption | null> {
  if (!UUID_RE.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_customers")
    .select(CUSTOMER_OPTION_COLUMNS)
    .eq("id", id)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toCustomerOption(data) : null;
}

/** Existe ao menos um cliente ativo? (contagem head-only, sem trafegar linhas) */
export async function hasActiveCustomers(): Promise<boolean> {
  const supabase = await createClient();
  const { count, error } = await supabase.from("customers").select("id", { count: "exact", head: true }).is("archived_at", null);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

/**
 * Busca no servidor para o seletor da nova venda (nome ou telefone), com poucas linhas:
 * o lateral de saldo de v_customers só é calculado para o resultado.
 * Nome: todas as palavras precisam aparecer (ILIKE). Telefone: ao menos 3 dígitos, sem letras.
 */
export async function searchCustomerOptions(query: string): Promise<CustomerOption[]> {
  const q = query.trim().replace(/\s+/g, " ");
  const hasLetters = /\p{L}/u.test(q);
  const digits = q.replace(/\D/g, "");
  if (hasLetters ? q.length < 2 : digits.length < 3) return [];

  const supabase = await createClient();
  let builder = supabase.from("v_customers").select(CUSTOMER_OPTION_COLUMNS).is("archived_at", null);
  if (hasLetters) {
    for (const word of q.split(" ").slice(0, 6)) builder = builder.ilike("full_name", `%${escapeLike(word)}%`);
  } else {
    // Telefones são gravados só com dígitos.
    builder = builder.or(`phone.ilike.%${digits}%,whatsapp.ilike.%${digits}%`);
  }
  const { data, error } = await builder.order("full_name").order("id").limit(CUSTOMER_SEARCH_LIMIT);
  if (error) throw new Error(error.message);
  return (data ?? []).map(toCustomerOption);
}

export type SaleDetail = {
  sale: SaleView;
  items: SaleItem[];
  installments: InstallmentView[];
  payments: PaymentView[];
  createdByName: string | null;
  cancelledByName: string | null;
};

/** Deduplicado por requisição (metadata + página). */
export const getSaleDetail = cache(async (id: string): Promise<SaleDetail | null> => {
  const supabase = await createClient();
  // Itens, parcelas e pagamentos só dependem do id: tudo em paralelo com a venda.
  const [saleRes, itemsRes, instRes, payRes] = await Promise.all([
    supabase.from("v_sales").select("*").eq("id", id).maybeSingle(),
    supabase.from("sale_items").select("*").eq("sale_id", id).order("created_at"),
    supabase.from("v_installments").select("*").eq("sale_id", id).order("number"),
    supabase.from("v_payments").select("*").eq("sale_id", id).order("paid_on", { ascending: false }).order("created_at", { ascending: false }),
  ]);
  if (saleRes.error) throw new Error(saleRes.error.message);
  const sale = saleRes.data;
  if (!sale) return null;
  if (itemsRes.error) throw new Error(itemsRes.error.message);
  if (instRes.error) throw new Error(instRes.error.message);
  if (payRes.error) throw new Error(payRes.error.message);

  // Só os nomes de quem criou/cancelou dependem da venda.
  const profileIds = [sale.created_by, sale.cancelled_by].filter((v): v is string => Boolean(v));
  const profRes = profileIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", profileIds)
    : { data: [] as { id: string; full_name: string }[], error: null };

  const names = new Map((profRes.data ?? []).map((p) => [p.id, p.full_name]));

  return {
    sale: sale as SaleView,
    items: itemsRes.data ?? [],
    installments: (instRes.data ?? []) as InstallmentView[],
    payments: (payRes.data ?? []) as PaymentView[],
    createdByName: sale.created_by ? (names.get(sale.created_by) ?? null) : null,
    cancelledByName: sale.cancelled_by ? (names.get(sale.cancelled_by) ?? null) : null,
  };
});
