"use server";

import { revalidatePath } from "next/cache";
import { assertOwner } from "@/lib/auth";
import { fail, ok, runAction, type ActionResult } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { cashAdjustmentSchema, closeCashDaySchema } from "./schemas";

function revalidateCash() {
  revalidatePath("/caixa");
  revalidatePath("/relatorios");
  revalidatePath("/");
}

/** Ajuste manual de caixa (somente proprietário). Positivo = entrada, negativo = saída. */
export async function createCashAdjustment(input: unknown): Promise<ActionResult> {
  return runAction(cashAdjustmentSchema, input, async (d) => {
    await assertOwner();
    const supabase = await createClient();
    const { error } = await supabase.rpc("cash_adjustment", {
      p_amount: Math.round(d.amount * 100) / 100,
      p_method: d.method,
      p_date: d.date,
      p_justification: d.justification,
    });
    if (error) return fail(error);
    revalidateCash();
    return ok(undefined, d.amount > 0 ? "Entrada registrada no caixa." : "Saída registrada no caixa.");
  });
}

/** Conferência (fechamento) do caixa de um dia. O banco calcula o esperado e a divergência. */
export async function closeCashDay(input: unknown): Promise<ActionResult> {
  return runAction(closeCashDaySchema, input, async (d) => {
    await assertOwner();
    const supabase = await createClient();
    // p_counted_cash aceita null no banco (dinheiro não contado); o tipo gerado não reflete isso.
    const args = { p_date: d.date, p_counted_cash: d.countedCash, p_notes: d.notes } as unknown as {
      p_date: string;
      p_counted_cash: number;
      p_notes: string;
    };
    const { error } = await supabase.rpc("close_cash_day", args);
    if (error) return fail(error);
    revalidateCash();
    return ok(undefined, "Caixa do dia conferido.");
  });
}
