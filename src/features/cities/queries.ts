import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/dates";
import type { City, VisitStatus } from "@/types/database";
import type { CitySort } from "./schemas";

/** Início amplo para que report_by_city considere todo o histórico. */
const SINCE = "2000-01-01";

export type CityListItem = {
  id: string;
  name: string;
  state: string;
  notes: string | null;
  archived: boolean;
  lastVisitDate: string | null;
  nextVisitDate: string | null;
  customersCount: number;
  overdueCustomers: number;
  pending: number;
  overdue: number;
};

export type CityTotals = {
  customersCount: number;
  overdueCustomers: number;
  pending: number;
  overdue: number;
};

const emptyTotals = (): CityTotals => ({ customersCount: 0, overdueCustomers: 0, pending: 0, overdue: 0 });

/**
 * Pendente/atraso e clientes ativos por cidade, agregados no banco pela RPC city_totals (uma ida só).
 * Usado para cidades arquivadas (report_by_city lista somente as ativas) e no detalhe da cidade.
 * A RPC devolve uma linha por id recebido (zeros quando não há dados); ids ausentes ficam zerados.
 */
async function fetchCityTotals(cityIds: string[]): Promise<Map<string, CityTotals>> {
  const out = new Map<string, CityTotals>(cityIds.map((id) => [id, emptyTotals()]));
  if (!cityIds.length) return out;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("city_totals", { p_city_ids: cityIds });
  if (error) throw error;
  for (const r of data ?? []) {
    if (!out.has(r.city_id)) continue;
    out.set(r.city_id, {
      customersCount: Number(r.customers_count ?? 0),
      overdueCustomers: Number(r.overdue_customers ?? 0),
      pending: Number(r.pending ?? 0),
      overdue: Number(r.overdue ?? 0),
    });
  }
  return out;
}

export async function listCities(opts: { archived: boolean; q?: string; sort: CitySort }): Promise<CityListItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("cities")
    .select("id, name, state, notes, archived, last_visit_date, next_visit_date")
    .eq("archived", opts.archived)
    .order("name");
  if (opts.q) query = query.ilike("name", `%${opts.q.replace(/[%_]/g, "")}%`);

  // Ativas: cidades e report_by_city são independentes e rodam juntas.
  // Arquivadas: city_totals precisa dos ids, então segue em sequência.
  const [citiesRes, reportRes] = await Promise.all([
    query,
    opts.archived ? null : supabase.rpc("report_by_city", { p_from: SINCE, p_to: todayISO() }),
  ]);
  if (citiesRes.error) throw citiesRes.error;
  const rows = citiesRes.data ?? [];

  let totals: Map<string, CityTotals>;
  if (!reportRes) {
    totals = await fetchCityTotals(rows.map((c) => c.id));
  } else {
    if (reportRes.error) throw reportRes.error;
    totals = new Map(
      (reportRes.data ?? []).map((r) => [
        r.city_id,
        {
          customersCount: Number(r.customers_count ?? 0),
          overdueCustomers: Number(r.overdue_customers ?? 0),
          pending: Number(r.total_pending ?? 0),
          overdue: Number(r.total_overdue ?? 0),
        },
      ]),
    );
  }

  const items: CityListItem[] = rows.map((c) => {
    const t = totals.get(c.id) ?? emptyTotals();
    return {
      id: c.id,
      name: c.name,
      state: c.state,
      notes: c.notes,
      archived: c.archived,
      lastVisitDate: c.last_visit_date,
      nextVisitDate: c.next_visit_date,
      ...t,
    };
  });

  const byName = (a: CityListItem, b: CityListItem) => a.name.localeCompare(b.name, "pt-BR");
  switch (opts.sort) {
    case "nome":
      return items.sort(byName);
    case "atraso":
      return items.sort((a, b) => b.overdue - a.overdue || b.pending - a.pending || byName(a, b));
    case "visita":
      // Nunca visitadas primeiro, depois a visita mais antiga
      return items.sort((a, b) => (a.lastVisitDate ?? "").localeCompare(b.lastVisitDate ?? "") || b.pending - a.pending);
    case "pendente":
    default:
      return items.sort((a, b) => b.pending - a.pending || b.overdue - a.overdue || byName(a, b));
  }
}

export type CityCustomer = {
  id: string;
  fullName: string;
  phone: string | null;
  whatsapp: string | null;
  neighborhood: string | null;
  balance: number;
  overdueAmount: number;
  financialStatus: string | null;
  nextCollectionDate: string | null;
};

export type CityToVisit = {
  customerId: string;
  fullName: string;
  phone: string | null;
  neighborhood: string | null;
  address: string | null;
  reference: string | null;
  balance: number;
  overdueAmount: number;
  nextCollectionDate: string | null;
  needsVisit: boolean;
  reason: string;
};

export type CityVisit = {
  id: string;
  visitDate: string;
  visitTime: string | null;
  status: VisitStatus;
  notes: string | null;
  total: number;
  attended: number;
};

export type CityDetail = {
  city: City;
  totals: CityTotals;
  customers: CityCustomer[];
  toVisit: CityToVisit[];
  upcomingVisits: CityVisit[];
  pastVisits: CityVisit[];
};

export const getCityDetail = cache(async (id: string): Promise<CityDetail | null> => {
  const supabase = await createClient();
  // Tudo depende só do id, então roda em paralelo; cidade inexistente apenas devolve listas vazias.
  const [cityRes, totalsMap, customersRes, toVisitRes, visitsRes] = await Promise.all([
    supabase.from("cities").select("*").eq("id", id).maybeSingle(),
    fetchCityTotals([id]),
    supabase
      .from("v_customers")
      .select("id, full_name, phone, whatsapp, neighborhood, balance, overdue_amount, financial_status, next_collection_date")
      .eq("city_id", id)
      .is("archived_at", null)
      .order("full_name"),
    supabase.rpc("customers_to_visit", { p_city_id: id }),
    supabase
      .from("visits")
      .select("id, visit_date, visit_time, status, notes, visit_customers(status)")
      .eq("city_id", id)
      .order("visit_date", { ascending: false })
      .limit(60),
  ]);
  if (cityRes.error) throw cityRes.error;
  const city = cityRes.data;
  if (!city) return null;
  if (customersRes.error) throw customersRes.error;
  if (toVisitRes.error) throw toVisitRes.error;
  if (visitsRes.error) throw visitsRes.error;

  const today = todayISO();
  const visits: CityVisit[] = (visitsRes.data ?? []).map((v) => {
    const vcs = v.visit_customers ?? [];
    return {
      id: v.id,
      visitDate: v.visit_date,
      visitTime: v.visit_time,
      status: v.status,
      notes: v.notes,
      total: vcs.length,
      attended: vcs.filter((x) => x.status !== "to_visit").length,
    };
  });

  return {
    city,
    totals: totalsMap.get(id) ?? emptyTotals(),
    customers: (customersRes.data ?? []).flatMap((c) =>
      c.id && c.full_name
        ? [
            {
              id: c.id,
              fullName: c.full_name,
              phone: c.phone,
              whatsapp: c.whatsapp,
              neighborhood: c.neighborhood,
              balance: Number(c.balance ?? 0),
              overdueAmount: Number(c.overdue_amount ?? 0),
              financialStatus: c.financial_status,
              nextCollectionDate: c.next_collection_date,
            },
          ]
        : [],
    ),
    toVisit: (toVisitRes.data ?? []).map((r) => ({
      customerId: r.customer_id,
      fullName: r.full_name,
      phone: r.phone,
      neighborhood: r.neighborhood,
      address: r.address,
      reference: r.reference,
      balance: Number(r.balance ?? 0),
      overdueAmount: Number(r.overdue_amount ?? 0),
      nextCollectionDate: r.next_collection_date,
      needsVisit: Boolean(r.needs_visit),
      reason: r.reason ?? "",
    })),
    upcomingVisits: visits
      .filter((v) => v.status === "planned" && v.visitDate >= today)
      .sort((a, b) => a.visitDate.localeCompare(b.visitDate)),
    pastVisits: visits.filter((v) => !(v.status === "planned" && v.visitDate >= today)),
  };
});
