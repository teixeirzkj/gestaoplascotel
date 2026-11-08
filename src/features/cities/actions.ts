"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertOwner } from "@/lib/auth";
import { ok, runAction, type ActionResult } from "@/lib/actions";
import { cityArchiveSchema, citySchema } from "./schemas";

function revalidateCities(id?: string) {
  revalidatePath("/cidades");
  if (id) revalidatePath(`/cidades/${id}`);
  revalidatePath("/agenda", "layout");
}

/** Cria ou edita uma cidade (somente proprietário). */
export async function saveCityAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(citySchema, input, async ({ id, name, state, notes }) => {
    const user = await assertOwner();
    const supabase = await createClient();
    const payload = { name, state, notes: notes ? notes : null };
    if (id) {
      const { error } = await supabase.from("cities").update(payload).eq("id", id);
      if (error) throw error;
      revalidateCities(id);
      return ok({ id }, "Cidade atualizada.");
    }
    const { data, error } = await supabase
      .from("cities")
      .insert({ ...payload, created_by: user.id })
      .select("id")
      .single();
    if (error) throw error;
    revalidateCities(data.id);
    return ok({ id: data.id }, "Cidade cadastrada.");
  });
}

/** Arquiva ou reativa uma cidade (somente proprietário). Cidades nunca são excluídas. */
export async function setCityArchivedAction(input: unknown): Promise<ActionResult<null>> {
  return runAction(cityArchiveSchema, input, async ({ id, archived }) => {
    await assertOwner();
    const supabase = await createClient();
    const { error } = await supabase.from("cities").update({ archived }).eq("id", id);
    if (error) throw error;
    revalidateCities(id);
    return ok(null, archived ? "Cidade arquivada." : "Cidade reativada.");
  });
}
