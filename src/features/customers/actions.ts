"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertOwner, assertUser } from "@/lib/auth";
import { fail, ok, runAction, type ActionResult } from "@/lib/actions";
import type { ActivityView } from "@/types/database";
import {
  activityPageSchema,
  archiveSchema,
  citySchema,
  customerFormSchema,
  customerUpdateSchema,
  noteSchema,
  onlyDigits,
  type CustomerFormValues,
} from "./schemas";
import { getCustomerActivity } from "./queries";
import type { CityOption } from "./types";

const nullable = (v: string) => (v.trim() === "" ? null : v.trim());

/** Normaliza o formulário para gravação: telefones só com dígitos, vazio => null. */
function toRow(v: CustomerFormValues) {
  return {
    full_name: v.full_name.trim().replace(/\s+/g, " "),
    phone: nullable(onlyDigits(v.phone)),
    whatsapp: nullable(onlyDigits(v.whatsapp)),
    city_id: v.city_id || null,
    neighborhood: nullable(v.neighborhood),
    address: nullable(v.address),
    reference: nullable(v.reference),
    notes: nullable(v.notes),
  };
}

function revalidateCustomer(id?: string) {
  revalidatePath("/clientes");
  if (id) revalidatePath(`/clientes/${id}`);
  revalidatePath("/");
}

export async function createCustomerAction(input: CustomerFormValues): Promise<ActionResult<{ id: string }>> {
  return runAction(customerFormSchema, input, async (data) => {
    const user = await assertOwner();
    const supabase = await createClient();
    const { data: row, error } = await supabase
      .from("customers")
      .insert({ ...toRow(data), created_by: user.id })
      .select("id")
      .single();
    if (error) throw error;
    revalidateCustomer(row.id);
    return ok({ id: row.id }, "Cliente cadastrado");
  });
}

export async function updateCustomerAction(input: CustomerFormValues & { id: string }): Promise<ActionResult<{ id: string }>> {
  return runAction(customerUpdateSchema, input, async ({ id, ...data }) => {
    await assertOwner();
    const supabase = await createClient();
    const { data: row, error } = await supabase.from("customers").update(toRow(data)).eq("id", id).select("id").maybeSingle();
    if (error) throw error;
    if (!row) return fail("Cliente não encontrado.");
    revalidateCustomer(id);
    revalidatePath("/cobrancas");
    revalidatePath("/vendas");
    return ok({ id }, "Dados do cliente atualizados");
  });
}

export async function setCustomerArchivedAction(input: { id: string; archived: boolean }): Promise<ActionResult<null>> {
  return runAction(archiveSchema, input, async ({ id, archived }) => {
    await assertOwner();
    const supabase = await createClient();
    const { data: row, error } = await supabase
      .from("customers")
      .update({ archived_at: archived ? new Date().toISOString() : null })
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!row) return fail("Cliente não encontrado.");
    revalidateCustomer(id);
    revalidatePath("/cobrancas");
    return ok(null, archived ? "Cliente arquivado" : "Cliente reativado");
  });
}

export async function createCityAction(input: { name: string; state: string }): Promise<ActionResult<CityOption>> {
  return runAction(citySchema, input, async ({ name, state }) => {
    const user = await assertOwner();
    const supabase = await createClient();
    const clean = name.replace(/\s+/g, " ");
    const { data: existing } = await supabase
      .from("cities")
      .select("id, name, state, archived")
      .ilike("name", clean.replace(/[%_\\]/g, "\\$&"))
      .eq("state", state)
      .maybeSingle();
    if (existing) {
      if (existing.archived) return fail(`${existing.name}/${existing.state} já existe e está arquivada. Reative-a em Cidades.`);
      return ok({ id: existing.id, name: existing.name, state: existing.state }, "Cidade já cadastrada — selecionada");
    }
    const { data: row, error } = await supabase
      .from("cities")
      .insert({ name: clean, state, created_by: user.id })
      .select("id, name, state")
      .single();
    if (error) throw error;
    revalidatePath("/cidades");
    return ok(row as CityOption, "Cidade cadastrada");
  });
}

export async function addCustomerNoteAction(input: { customer_id: string; kind: string; body: string }): Promise<ActionResult<null>> {
  return runAction(noteSchema, input, async ({ customer_id, kind, body }) => {
    const user = await assertUser();
    const supabase = await createClient();
    const { error } = await supabase.from("customer_notes").insert({ customer_id, kind, body, created_by: user.id });
    if (error) throw error;
    revalidatePath(`/clientes/${customer_id}`);
    if (kind !== "note") revalidatePath("/clientes");
    return ok(null, "Observação registrada");
  });
}

export async function loadCustomerActivityAction(input: { customerId: string; offset: number }): Promise<ActionResult<ActivityView[]>> {
  return runAction(activityPageSchema, input, async ({ customerId, offset }) => {
    await assertUser();
    return ok(await getCustomerActivity(customerId, offset));
  });
}
