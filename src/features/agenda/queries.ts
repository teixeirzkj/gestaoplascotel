import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { addDays, todayISO } from "@/lib/dates";
import type { InstallmentView, VisitCustomerStatus, VisitStatus } from "@/types/database";
import type {
  CityNeedingVisit,
  CityOption,
  RouteVisit,
  VisitCandidates,
  VisitCustomerDetail,
  VisitDetail,
  VisitSummary,
} from "./types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const SUMMARY_SELECT = "id, city_id, visit_date, visit_time, notes, status, cities(name, state), visit_customers(status)" as const;

type SummaryRow = {
  id: string;
  city_id: string;
  visit_date: string;
  visit_time: string | null;
  notes: string | null;
  status: VisitStatus;
  cities: { name: string; state: string } | null;
  visit_customers: { status: VisitCustomerStatus }[] | null;
};

function toSummary(v: SummaryRow): VisitSummary {
  const vcs = v.visit_customers ?? [];
  return {
    id: v.id,
    cityId: v.city_id,
    cityName: v.cities?.name ?? "Cidade",
    cityState: v.cities?.state ?? "",
    visitDate: v.visit_date,
    visitTime: v.visit_time,
    notes: v.notes,
    status: v.status,
    total: vcs.length,
    attended: vcs.filter((x) => x.status !== "to_visit").length,
  };
}

export async function listActiveCities(): Promise<CityOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("cities").select("id, name, state").eq("archived", false).order("name");
  if (error) throw error;
  return data ?? [];
}

/** Visitas planejadas a partir de 60 dias atrás (as passadas ainda abertas aparecem como pendentes de conclusão). */
export async function listUpcomingVisits(): Promise<VisitSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("visits")
    .select(SUMMARY_SELECT)
    .eq("status", "planned")
    .gte("visit_date", addDays(todayISO(), -60))
    .order("visit_date")
    .order("visit_time", { nullsFirst: false })
    .limit(300);
  if (error) throw error;
  return ((data ?? []) as SummaryRow[]).map(toSummary);
}

export async function listVisitsInRange(from: string, to: string): Promise<VisitSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("visits")
    .select(SUMMARY_SELECT)
    .gte("visit_date", from)
    .lte("visit_date", to)
    .order("visit_date")
    .order("visit_time", { nullsFirst: false })
    .limit(500);
  if (error) throw error;
  return ((data ?? []) as SummaryRow[]).map(toSummary);
}

export async function listVisitHistory(opts: { page: number; pageSize: number; cityId?: string | null; status?: "done" | "cancelled" | null }) {
  const supabase = await createClient();
  const from = (opts.page - 1) * opts.pageSize;
  let query = supabase
    .from("visits")
    .select(SUMMARY_SELECT, { count: "exact" })
    .order("visit_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, from + opts.pageSize - 1);
  query = opts.status ? query.eq("status", opts.status) : query.in("status", ["done", "cancelled"]);
  if (opts.cityId) query = query.eq("city_id", opts.cityId);
  const { data, error, count } = await query;
  if (error) throw error;
  return { items: ((data ?? []) as SummaryRow[]).map(toSummary), total: count ?? 0 };
}

/**
 * Cidades ativas sem visita futura agendada que têm clientes em atraso ou pedidos de visita presencial.
 * Ajuda a decidir o próximo agendamento.
 */
export async function listCitiesNeedingVisit(limit = 6): Promise<CityNeedingVisit[]> {
  const supabase = await createClient();
  const today = todayISO();
  const [citiesRes, reportRes, requestsRes] = await Promise.all([
    supabase.from("cities").select("id, name, state, last_visit_date, next_visit_date").eq("archived", false),
    supabase.rpc("report_by_city", { p_from: today, p_to: today }),
    supabase
      .from("v_installments")
      .select("city_id, customer_id")
      .eq("needs_visit", true)
      .not("status", "in", "(paid,cancelled)")
      .not("city_id", "is", null),
  ]);
  if (citiesRes.error) throw citiesRes.error;
  if (reportRes.error) throw reportRes.error;
  if (requestsRes.error) throw requestsRes.error;

  const requests = new Map<string, Set<string>>();
  for (const r of requestsRes.data ?? []) {
    if (!r.city_id || !r.customer_id) continue;
    const s = requests.get(r.city_id) ?? new Set<string>();
    s.add(r.customer_id);
    requests.set(r.city_id, s);
  }
  const report = new Map((reportRes.data ?? []).map((r) => [r.city_id, r]));

  return (citiesRes.data ?? [])
    .filter((c) => !c.next_visit_date)
    .map((c) => {
      const r = report.get(c.id);
      return {
        cityId: c.id,
        cityName: c.name,
        cityState: c.state,
        overdue: Number(r?.total_overdue ?? 0),
        overdueCustomers: Number(r?.overdue_customers ?? 0),
        visitRequests: requests.get(c.id)?.size ?? 0,
        lastVisitDate: c.last_visit_date,
      };
    })
    .filter((c) => c.overdue > 0 || c.visitRequests > 0)
    .sort((a, b) => b.visitRequests - a.visitRequests || b.overdue - a.overdue)
    .slice(0, limit);
}

// -----------------------------------------------------------------------------
// Detalhe da visita / roteiro
// -----------------------------------------------------------------------------

const VISIT_CUSTOMERS_SELECT =
  "id, visit_id, customer_id, status, notes, stop_order, updated_at, customers(full_name, phone, whatsapp, neighborhood, address, reference, latitude, longitude)" as const;

const ROUTE_VISIT_SELECT =
  `id, city_id, visit_time, status, notes, route_order, cities(name, state, latitude, longitude), visit_customers(${VISIT_CUSTOMERS_SELECT})` as const;

type VisitCustomerRow = {
  id: string;
  visit_id: string;
  customer_id: string;
  status: VisitCustomerStatus;
  notes: string | null;
  stop_order: number | null;
  updated_at: string;
  customers: {
    full_name: string;
    phone: string | null;
    whatsapp: string | null;
    neighborhood: string | null;
    address: string | null;
    reference: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
};

/** Enriquecimento: saldo/atraso (v_customers), motivo (customers_to_visit) e parcela em aberto mais antiga (v_installments). */
async function enrichVisitCustomers(
  supabase: Supabase,
  rows: VisitCustomerRow[],
  cityIds: string[],
): Promise<Map<string, VisitCustomerDetail[]>> {
  const customerIds = Array.from(new Set(rows.map((r) => r.customer_id)));
  const byVisit = new Map<string, VisitCustomerDetail[]>();
  if (!rows.length) return byVisit;

  const [balancesRes, installmentsRes, ...reasonsRes] = await Promise.all([
    supabase.from("v_customers").select("id, balance, overdue_amount").in("id", customerIds),
    supabase
      .from("v_installments")
      .select("*")
      .in("customer_id", customerIds)
      .not("status", "in", "(paid,cancelled)")
      .order("original_due_date")
      .order("number"),
    ...cityIds.map((cityId) => supabase.rpc("customers_to_visit", { p_city_id: cityId })),
  ]);
  if (balancesRes.error) throw balancesRes.error;
  if (installmentsRes.error) throw installmentsRes.error;

  const balances = new Map((balancesRes.data ?? []).map((b) => [b.id ?? "", b]));
  const reasons = new Map<string, string>();
  for (const res of reasonsRes) {
    if (res.error) throw res.error;
    for (const r of res.data ?? []) if (r.reason) reasons.set(r.customer_id, r.reason);
  }
  const oldest = new Map<string, InstallmentView>();
  const openCount = new Map<string, number>();
  for (const inst of (installmentsRes.data ?? []) as InstallmentView[]) {
    if (!oldest.has(inst.customer_id)) oldest.set(inst.customer_id, inst);
    openCount.set(inst.customer_id, (openCount.get(inst.customer_id) ?? 0) + 1);
  }

  for (const r of rows) {
    const b = balances.get(r.customer_id);
    const c = r.customers;
    const detail: VisitCustomerDetail = {
      id: r.id,
      customerId: r.customer_id,
      status: r.status,
      notes: r.notes,
      stopOrder: r.stop_order,
      updatedAt: r.updated_at,
      fullName: c?.full_name ?? "Cliente",
      phone: c?.phone ?? null,
      whatsapp: c?.whatsapp ?? null,
      neighborhood: c?.neighborhood ?? null,
      address: c?.address ?? null,
      reference: c?.reference ?? null,
      latitude: c?.latitude ?? null,
      longitude: c?.longitude ?? null,
      balance: Number(b?.balance ?? 0),
      overdueAmount: Number(b?.overdue_amount ?? 0),
      reason: reasons.get(r.customer_id) ?? null,
      oldestOpen: oldest.get(r.customer_id) ?? null,
      openCount: openCount.get(r.customer_id) ?? 0,
    };
    const list = byVisit.get(r.visit_id);
    if (list) list.push(detail);
    else byVisit.set(r.visit_id, [detail]);
  }
  return byVisit;
}

export const getVisitDetail = cache(async (id: string): Promise<VisitDetail | null> => {
  const supabase = await createClient();
  // As duas consultas só dependem do id: rodam em paralelo.
  const [visitRes, vcRes] = await Promise.all([
    supabase
      .from("visits")
      .select("id, city_id, visit_date, visit_time, notes, status, created_at, cities(name, state, latitude, longitude), creator:profiles!visits_created_by_fkey(full_name)")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("visit_customers").select(VISIT_CUSTOMERS_SELECT).eq("visit_id", id),
  ]);
  if (visitRes.error) throw visitRes.error;
  if (vcRes.error) throw vcRes.error;
  const visit = visitRes.data;
  if (!visit) return null;
  const vcs = vcRes.data;

  const byVisit = await enrichVisitCustomers(supabase, (vcs ?? []) as VisitCustomerRow[], [visit.city_id]);

  const city = visit.cities as { name: string; state: string; latitude: number | null; longitude: number | null } | null;
  const creator = visit.creator as { full_name: string } | null;
  return {
    id: visit.id,
    cityId: visit.city_id,
    cityName: city?.name ?? "Cidade",
    cityState: city?.state ?? "",
    cityLatitude: city?.latitude ?? null,
    cityLongitude: city?.longitude ?? null,
    visitDate: visit.visit_date,
    visitTime: visit.visit_time,
    notes: visit.notes,
    status: visit.status,
    createdAt: visit.created_at,
    createdByName: creator?.full_name ?? null,
    customers: byVisit.get(visit.id) ?? [],
  };
});

/** Datas com visitas planejadas (de hoje em diante) para navegação rápida do roteiro. */
export async function listRouteDates(limit = 14): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("visits")
    .select("visit_date")
    .eq("status", "planned")
    .gte("visit_date", todayISO())
    .order("visit_date")
    .limit(200);
  if (error) throw error;
  return Array.from(new Set((data ?? []).map((d) => d.visit_date))).slice(0, limit);
}

/** Visitas (não canceladas) de uma data, com clientes enriquecidos. */
export async function getRouteDay(date: string): Promise<RouteVisit[]> {
  const supabase = await createClient();
  const { data: visits, error } = await supabase
    .from("visits")
    .select(ROUTE_VISIT_SELECT)
    .eq("visit_date", date)
    .neq("status", "cancelled")
    .order("route_order", { nullsFirst: false })
    .order("visit_time", { nullsFirst: false })
    .order("created_at");
  if (error) throw error;
  const list = visits ?? [];
  if (!list.length) return [];

  // Clientes vêm embutidos no select das visitas (uma ida a menos ao banco).
  const vcs = list.flatMap((v) => (v.visit_customers ?? []) as VisitCustomerRow[]);
  const byVisit = await enrichVisitCustomers(
    supabase,
    vcs,
    Array.from(new Set(list.map((v) => v.city_id))),
  );

  return list.map((v) => {
    const city = v.cities as { name: string; state: string; latitude: number | null; longitude: number | null } | null;
    return {
      id: v.id,
      cityId: v.city_id,
      cityName: city?.name ?? "Cidade",
      cityState: city?.state ?? "",
      cityLatitude: city?.latitude ?? null,
      cityLongitude: city?.longitude ?? null,
      visitTime: v.visit_time,
      status: v.status,
      notes: v.notes,
      customers: byVisit.get(v.id) ?? [],
    };
  });
}

/** Sugestões (customers_to_visit) + demais clientes ativos da cidade. */
export async function getVisitCandidates(cityId: string): Promise<VisitCandidates> {
  const supabase = await createClient();
  const [suggestedRes, othersRes] = await Promise.all([
    supabase.rpc("customers_to_visit", { p_city_id: cityId }),
    supabase
      .from("v_customers")
      .select("id, full_name, neighborhood, balance")
      .eq("city_id", cityId)
      .is("archived_at", null)
      .order("full_name")
      .limit(500),
  ]);
  if (suggestedRes.error) throw suggestedRes.error;
  if (othersRes.error) throw othersRes.error;
  const suggested = (suggestedRes.data ?? []).map((r) => ({
    customerId: r.customer_id,
    fullName: r.full_name,
    neighborhood: r.neighborhood,
    balance: Number(r.balance ?? 0),
    overdueAmount: Number(r.overdue_amount ?? 0),
    needsVisit: Boolean(r.needs_visit),
    reason: r.reason ?? "",
    preselect: Number(r.overdue_amount ?? 0) > 0 || Boolean(r.needs_visit),
  }));
  const suggestedIds = new Set(suggested.map((s) => s.customerId));
  const others = (othersRes.data ?? []).flatMap((c) =>
    c.id && c.full_name && !suggestedIds.has(c.id)
      ? [{ customerId: c.id, fullName: c.full_name, neighborhood: c.neighborhood, balance: Number(c.balance ?? 0) }]
      : [],
  );
  return { suggested, others };
}
