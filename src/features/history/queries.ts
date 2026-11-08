import "server-only";
import { createClient } from "@/lib/supabase/server";
import { addDays, isISODate } from "@/lib/dates";
import type { ActivityView } from "@/types/database";
import { ACTIVITY_GROUPS, isActivityGroup, type ActivityGroupKey } from "./constants";

export const HISTORY_PAGE_SIZE = 30;

export type HistoryFilters = {
  q: string;
  tipo: ActivityGroupKey | null;
  usuario: string | null;
  cliente: string | null;
  de: string | null;
  ate: string | null;
  page: number;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export function parseHistoryFilters(sp: Record<string, string | string[] | undefined>): HistoryFilters {
  const q = (first(sp.q) ?? "").trim().slice(0, 80);
  const tipo = first(sp.tipo);
  const usuario = first(sp.usuario);
  const cliente = first(sp.cliente);
  const de = first(sp.de);
  const ate = first(sp.ate);
  const page = Math.max(1, Math.min(10_000, Number.parseInt(first(sp.page) ?? "1", 10) || 1));
  return {
    q,
    tipo: isActivityGroup(tipo) ? tipo : null,
    usuario: usuario && UUID.test(usuario) ? usuario : null,
    cliente: cliente && UUID.test(cliente) ? cliente : null,
    de: isISODate(de) ? de : null,
    ate: isISODate(ate) ? ate : null,
    page,
  };
}

/** Início do dia em America/Bahia (UTC-3, sem horário de verão) */
const bahiaStart = (iso: string) => `${iso}T00:00:00-03:00`;

export async function getHistory(f: HistoryFilters): Promise<{ items: ActivityView[]; total: number }> {
  const supabase = await createClient();
  const from = (f.page - 1) * HISTORY_PAGE_SIZE;
  let query = supabase
    .from("v_activity")
    .select("*", { count: "exact" })
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + HISTORY_PAGE_SIZE - 1);

  if (f.q) query = query.ilike("summary", `%${f.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  if (f.tipo) query = query.or(ACTIVITY_GROUPS[f.tipo].filter);
  if (f.usuario) query = query.eq("actor_id", f.usuario);
  if (f.cliente) query = query.eq("customer_id", f.cliente);
  if (f.de) query = query.gte("occurred_at", bahiaStart(f.de));
  if (f.ate) query = query.lt("occurred_at", bahiaStart(addDays(f.ate, 1)));

  const { data, error, count } = await query;
  if (error) throw error;
  return { items: (data ?? []) as ActivityView[], total: count ?? 0 };
}

export type Option = { value: string; label: string };

export async function getHistoryFilterOptions(): Promise<{ users: Option[] }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("id, full_name, email").order("full_name");
  if (error) throw error;
  return { users: (data ?? []).map((u) => ({ value: u.id, label: u.full_name || u.email || "Usuário" })) };
}

/** Nome do cliente já escolhido no filtro (?cliente=), para exibir no campo de busca. */
export async function getHistoryCustomerOption(id: string | null): Promise<Option | null> {
  if (!id) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("customers").select("id, full_name").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? { value: data.id, label: data.full_name } : null;
}
