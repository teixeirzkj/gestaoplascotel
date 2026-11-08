"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertOwner, assertUser } from "@/lib/auth";
import { fail, ok, runAction, type ActionResult } from "@/lib/actions";
import { getVisitCandidates } from "./queries";
import type { VisitCandidates } from "./types";
import {
  addVisitCustomersSchema,
  cityIdSchema,
  createVisitSchema,
  reorderStopsSchema,
  setVisitCustomerStatusSchema,
  setVisitStatusSchema,
  updateVisitSchema,
  visitIdSchema,
} from "./schemas";

function revalidateAgenda(cityId?: string | null) {
  revalidatePath("/agenda", "layout");
  revalidatePath("/cidades");
  if (cityId) revalidatePath(`/cidades/${cityId}`);
  revalidatePath("/");
}

const toTime = (t: string) => (t ? (t.length === 5 ? `${t}:00` : t) : null);

/** Clientes sugeridos/ativos da cidade para montar a visita. */
export async function getVisitCandidatesAction(cityId: string): Promise<ActionResult<VisitCandidates>> {
  return runAction(cityIdSchema, cityId, async (id) => {
    await assertUser();
    return ok(await getVisitCandidates(id));
  });
}

/** Agenda uma visita (qualquer usuário ativo) com os clientes selecionados na ordem informada. */
export async function createVisitAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(createVisitSchema, input, async ({ cityId, date, time, notes, customerIds }) => {
    const user = await assertUser();
    const supabase = await createClient();
    const { data: city, error: cityErr } = await supabase.from("cities").select("id, archived").eq("id", cityId).maybeSingle();
    if (cityErr) throw cityErr;
    if (!city) return fail("Cidade não encontrada.");
    if (city.archived) return fail("Esta cidade está arquivada. Reative-a para agendar visitas.");

    const { data: visit, error } = await supabase
      .from("visits")
      .insert({ city_id: cityId, visit_date: date, visit_time: toTime(time), notes: notes || null, created_by: user.id })
      .select("id")
      .single();
    if (error) throw error;

    const unique = Array.from(new Set(customerIds));
    if (unique.length) {
      const { error: vcErr } = await supabase
        .from("visit_customers")
        .insert(unique.map((customer_id, i) => ({ visit_id: visit.id, customer_id, stop_order: i + 1, updated_by: user.id })));
      if (vcErr) {
        // Sem transação via PostgREST: remove a visita recém-criada (proprietário) para não deixar registro incompleto.
        if (user.isOwner) await supabase.from("visits").delete().eq("id", visit.id);
        throw vcErr;
      }
    }
    revalidateAgenda(cityId);
    return ok({ id: visit.id }, unique.length ? `Visita agendada com ${unique.length} ${unique.length === 1 ? "cliente" : "clientes"}.` : "Visita agendada.");
  });
}

export async function updateVisitAction(input: unknown): Promise<ActionResult<null>> {
  return runAction(updateVisitSchema, input, async ({ id, date, time, notes }) => {
    await assertUser();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("visits")
      .update({ visit_date: date, visit_time: toTime(time), notes: notes || null })
      .eq("id", id)
      .select("city_id")
      .maybeSingle();
    if (error) throw error;
    if (!data) return fail("Visita não encontrada.");
    revalidateAgenda(data.city_id);
    return ok(null, "Visita atualizada.");
  });
}

export async function setVisitStatusAction(input: unknown): Promise<ActionResult<null>> {
  return runAction(setVisitStatusSchema, input, async ({ id, status }) => {
    await assertUser();
    const supabase = await createClient();
    const { data, error } = await supabase.from("visits").update({ status }).eq("id", id).select("city_id").maybeSingle();
    if (error) throw error;
    if (!data) return fail("Visita não encontrada.");
    revalidateAgenda(data.city_id);
    const msg = { planned: "Visita reaberta.", done: "Visita marcada como realizada.", cancelled: "Visita cancelada." }[status];
    return ok(null, msg);
  });
}

/** Exclui a visita (somente proprietário) — apenas se nenhum atendimento foi registrado. */
export async function deleteVisitAction(input: unknown): Promise<ActionResult<null>> {
  return runAction(visitIdSchema, input, async ({ id }) => {
    await assertOwner();
    const supabase = await createClient();
    const { data: visit, error } = await supabase.from("visits").select("id, city_id").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!visit) return fail("Visita não encontrada.");
    const { count, error: cErr } = await supabase
      .from("visit_customers")
      .select("id", { count: "exact", head: true })
      .eq("visit_id", id)
      .neq("status", "to_visit");
    if (cErr) throw cErr;
    if ((count ?? 0) > 0) return fail("Esta visita já tem atendimentos registrados. Cancele-a em vez de excluir.");
    const { error: delErr } = await supabase.from("visits").delete().eq("id", id);
    if (delErr) throw delErr;
    revalidateAgenda(visit.city_id);
    return ok(null, "Visita excluída.");
  });
}

export async function addVisitCustomersAction(input: unknown): Promise<ActionResult<null>> {
  return runAction(addVisitCustomersSchema, input, async ({ visitId, customerIds }) => {
    const user = await assertUser();
    const supabase = await createClient();
    const [visitRes, existingRes] = await Promise.all([
      supabase.from("visits").select("id, city_id").eq("id", visitId).maybeSingle(),
      supabase.from("visit_customers").select("customer_id, stop_order").eq("visit_id", visitId),
    ]);
    if (visitRes.error) throw visitRes.error;
    if (existingRes.error) throw existingRes.error;
    if (!visitRes.data) return fail("Visita não encontrada.");
    const existing = new Set((existingRes.data ?? []).map((r) => r.customer_id));
    const maxOrder = Math.max(0, ...(existingRes.data ?? []).map((r) => r.stop_order ?? 0), (existingRes.data ?? []).length);
    const toAdd = Array.from(new Set(customerIds)).filter((id) => !existing.has(id));
    if (!toAdd.length) return fail("Os clientes selecionados já estão nesta visita.");
    const { error } = await supabase
      .from("visit_customers")
      .insert(toAdd.map((customer_id, i) => ({ visit_id: visitId, customer_id, stop_order: maxOrder + i + 1, updated_by: user.id })));
    if (error) throw error;
    revalidateAgenda(visitRes.data.city_id);
    return ok(null, toAdd.length === 1 ? "Cliente adicionado à visita." : `${toAdd.length} clientes adicionados à visita.`);
  });
}

/** Remove um cliente da visita — somente enquanto estiver "A visitar" (também garantido por RLS). */
export async function removeVisitCustomerAction(input: unknown): Promise<ActionResult<null>> {
  return runAction(visitIdSchema, input, async ({ id }) => {
    await assertUser();
    const supabase = await createClient();
    const { data: row, error } = await supabase.from("visit_customers").select("id, status, visits(city_id)").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!row) return fail("Cliente não encontrado nesta visita.");
    if (row.status !== "to_visit") return fail("Só é possível remover clientes ainda não atendidos (status “A visitar”).");
    const { error: delErr } = await supabase.from("visit_customers").delete().eq("id", id);
    if (delErr) throw delErr;
    const visit = row.visits as { city_id: string } | null;
    revalidateAgenda(visit?.city_id);
    return ok(null, "Cliente removido da visita.");
  });
}

/** Registra o resultado do atendimento (RPC set_visit_customer_status, com auditoria). */
export async function setVisitCustomerStatusAction(input: unknown): Promise<ActionResult<null>> {
  return runAction(setVisitCustomerStatusSchema, input, async ({ id, status, notes }) => {
    await assertUser();
    const supabase = await createClient();
    const { error } = await supabase.rpc("set_visit_customer_status", { p_visit_customer_id: id, p_status: status, p_notes: notes ?? "" });
    if (error) throw error;
    revalidateAgenda();
    revalidatePath("/clientes", "layout");
    return ok(null, "Atendimento registrado.");
  });
}

/**
 * Grava a ordem das paradas (stop_order 1..n) conforme a lista recebida.
 * A RPC reorder_visit_stops valida a lista (sem duplicadas, exatamente as paradas da visita)
 * e atualiza só as linhas que mudaram, num único UPDATE atômico.
 */
export async function reorderStopsAction(input: unknown): Promise<ActionResult<null>> {
  return runAction(reorderStopsSchema, input, async ({ visitId, orderedIds }) => {
    await assertUser();
    if (new Set(orderedIds).size !== orderedIds.length) {
      return fail("A lista de paradas está desatualizada. Recarregue a página.");
    }
    const supabase = await createClient();
    const { error } = await supabase.rpc("reorder_visit_stops", { p_visit: visitId, p_ids: orderedIds });
    if (error) throw error;
    revalidatePath("/agenda", "layout");
    return ok(null);
  });
}
