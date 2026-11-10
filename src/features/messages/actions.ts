"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertOwner, assertUser } from "@/lib/auth";
import { fail, ok, runAction, type ActionResult } from "@/lib/actions";
import { MESSAGE_KINDS, messageSettingsSchema, type MessageSettingsInput } from "./config";

const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");

const recordSchema = z.object({
  customerId: z.string().uuid(),
  kind: z.enum(MESSAGE_KINDS),
  status: z.enum(["sent", "skipped"]),
  body: z.string().max(4000).nullable(),
  amount: z.number().nonnegative().nullable(),
  installments: z.array(z.object({ id: z.string().uuid(), ref_date: iso })).max(50),
  promiseId: z.string().uuid().nullable(),
  paymentId: z.string().uuid().nullable(),
  refDate: iso.nullable(),
  skipReason: z.string().trim().max(300).nullable(),
});

/** Registra que a mensagem foi enviada pelo WhatsApp (ou pulada, com motivo). */
export async function recordMessageAction(input: z.input<typeof recordSchema>): Promise<ActionResult<null>> {
  return runAction(recordSchema, input, async (d) => {
    await assertUser();
    const supabase = await createClient();
    const { error } = await supabase.rpc("record_customer_message", {
      p_customer_id: d.customerId,
      p_kind: d.kind,
      p_status: d.status,
      p_body: (d.body ?? null) as never, // null é válido no SQL
      p_amount: (d.amount ?? null) as never, // null é válido no SQL
      p_installments: d.installments,
      p_promise_id: (d.promiseId ?? null) as never, // null é válido no SQL
      p_payment_id: (d.paymentId ?? null) as never, // null é válido no SQL
      p_ref_date: (d.refDate ?? null) as never, // null é válido no SQL
      p_skip_reason: (d.skipReason ?? null) as never, // null é válido no SQL
    });
    if (error) return fail(error);
    revalidatePath("/mensagens");
    revalidatePath("/");
    revalidatePath(`/clientes/${d.customerId}`);
    return ok(null, d.status === "sent" ? "Envio registrado no histórico do cliente." : "Mensagem pulada.");
  });
}

const optOutSchema = z.object({ customerId: z.string().uuid(), optOut: z.boolean(), reason: z.string().trim().max(300).nullable() });

/** Cliente pediu para não receber (ou voltou a receber) mensagens de cobrança. */
export async function setMessagesOptOutAction(input: z.input<typeof optOutSchema>): Promise<ActionResult<null>> {
  return runAction(optOutSchema, input, async (d) => {
    await assertUser();
    const supabase = await createClient();
    const { error } = await supabase.rpc("set_customer_messages_opt_out", {
      p_customer_id: d.customerId,
      p_opt_out: d.optOut,
      p_reason: (d.reason ?? null) as never, // null é válido no SQL
    });
    if (error) return fail(error);
    revalidatePath("/mensagens");
    revalidatePath(`/clientes/${d.customerId}`);
    return ok(null, d.optOut ? "Cliente não receberá mais mensagens de cobrança." : "Cliente voltará a receber mensagens.");
  });
}

/** Proprietário: salva calendário, textos e dados do Pix. */
export async function updateMessageSettingsAction(input: MessageSettingsInput): Promise<ActionResult<null>> {
  return runAction(messageSettingsSchema, input, async (data) => {
    const user = await assertOwner();
    const supabase = await createClient();
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "messages", value: data, updated_by: user.id, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) return fail(error);
    revalidatePath("/mensagens");
    revalidatePath("/configuracoes");
    return ok(null, "Configurações de mensagens salvas.");
  });
}
