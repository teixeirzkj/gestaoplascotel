"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertUser } from "@/lib/auth";
import { ok, runAction, type ActionResult } from "@/lib/actions";
import type { Option } from "./queries";

const SEARCH_LIMIT = 20;

const searchSchema = z.object({ q: z.string().max(80, "Busca muito longa.") });

/** Busca clientes por nome para o filtro do histórico (inclui arquivados: o histórico deles continua valendo). */
export async function searchCustomerOptions(q: string): Promise<ActionResult<Option[]>> {
  return runAction(searchSchema, { q }, async ({ q }) => {
    await assertUser();
    const term = q.trim();
    if (term.length < 2) return ok([]);
    const escaped = term.replace(/[\\%_]/g, (c) => `\\${c}`);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("customers")
      .select("id, full_name")
      .ilike("full_name", `%${escaped}%`)
      .order("full_name")
      .limit(SEARCH_LIMIT);
    if (error) throw error;
    return ok((data ?? []).map((c) => ({ value: c.id, label: c.full_name })));
  });
}
