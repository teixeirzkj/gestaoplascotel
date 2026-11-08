"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertOwner, assertUser } from "@/lib/auth";
import { fail, ok, runAction, type ActionResult } from "@/lib/actions";
import { todayISO } from "@/lib/dates";
import { formatBRL } from "@/lib/format";
import { PAYMENT_STATUS } from "@/lib/labels";
import { num, toCents } from "@/lib/money";
import type { Database } from "@/types/supabase";
import {
  paymentIdSchema,
  paymentReasonSchema,
  postponeSchema,
  promiseSchema,
  receiptSchema,
  registerPaymentSchema,
  resolvePromiseSchema,
  reverseSchema,
  type PostponeInput,
  type PromiseInput,
  type ReceiptInput,
  type RegisterPaymentInput,
  type ResolvePromiseInput,
} from "./schemas";

type Fns = Database["public"]["Functions"];
/** Os tipos gerados não marcam parâmetros opcionais das RPCs como anuláveis. */
type NullableArgs<T> = { [K in keyof T]: T[K] | null };

/** Atualiza tudo que depende de parcelas/pagamentos (dashboard, cobranças, clientes, vendas, caixa). */
function revalidateFinance() {
  revalidatePath("/", "layout");
}

export type RegisteredPayment = {
  paymentId: string;
  /** Status gravado no banco (não o que o formulário pediu). */
  status: string;
  confirmed: boolean;
  /** Valor gravado no banco. */
  amount: number;
  /**
   * true quando a chave de idempotência já tinha sido usada e o pagamento gravado difere do formulário
   * (ex.: a resposta do 1º envio se perdeu e o usuário alterou valor/confirmação antes de reenviar).
   */
  mismatch: boolean;
};

export async function registerPaymentAction(input: RegisterPaymentInput): Promise<ActionResult<RegisteredPayment>> {
  return runAction(registerPaymentSchema, input, async (d) => {
    await assertUser();
    if (d.paidOn > todayISO()) return fail("A data do pagamento não pode estar no futuro.");
    const supabase = await createClient();
    const args: NullableArgs<Fns["register_payment"]["Args"]> = {
      p_installment_id: d.installmentId,
      p_amount: d.amount,
      p_paid_on: d.paidOn,
      p_method: d.method,
      p_notes: d.notes,
      p_confirm: d.confirm,
      p_idempotency_key: d.idempotencyKey,
    };
    const { data, error } = await supabase.rpc("register_payment", args as Fns["register_payment"]["Args"]);
    if (error) throw error;
    revalidateFinance();
    // Reenvio com a mesma chave devolve o pagamento ORIGINAL: responde com o que está gravado, não com o formulário.
    const { data: p, error: readError } = await supabase.from("payments").select("id, amount, status").eq("id", data as string).single();
    if (readError) throw readError;
    const amount = num(p.amount);
    const confirmed = p.status === "confirmed";
    const mismatch = toCents(amount) !== toCents(d.amount) || confirmed !== d.confirm;
    const message = mismatch
      ? `Este pagamento já havia sido registrado antes, com ${formatBRL(amount)} (${(PAYMENT_STATUS[p.status]?.label ?? p.status).toLowerCase()}). Os novos dados não foram aplicados.`
      : confirmed
        ? "Pagamento registrado e confirmado."
        : "Pagamento registrado — aguardando confirmação.";
    return ok({ paymentId: p.id, status: p.status, confirmed, amount, mismatch }, message);
  });
}

export async function confirmPaymentAction(paymentId: string): Promise<ActionResult> {
  return runAction(paymentIdSchema, { paymentId }, async (d) => {
    await assertUser();
    const supabase = await createClient();
    const { error } = await supabase.rpc("confirm_payment", { p_payment_id: d.paymentId });
    if (error) throw error;
    revalidateFinance();
    return ok(undefined, "Pagamento confirmado.");
  });
}

export async function rejectPaymentAction(input: { paymentId: string; reason: string }): Promise<ActionResult> {
  return runAction(paymentReasonSchema, input, async (d) => {
    await assertUser();
    const supabase = await createClient();
    const { error } = await supabase.rpc("reject_payment", { p_payment_id: d.paymentId, p_reason: d.reason });
    if (error) throw error;
    revalidateFinance();
    return ok(undefined, "Pagamento marcado como não confirmado.");
  });
}

export async function reversePaymentAction(input: { paymentId: string; reason: string }): Promise<ActionResult> {
  return runAction(reverseSchema, input, async (d) => {
    await assertOwner();
    const supabase = await createClient();
    const { error } = await supabase.rpc("reverse_payment", { p_payment_id: d.paymentId, p_reason: d.reason });
    if (error) throw error;
    revalidateFinance();
    return ok(undefined, "Pagamento estornado.");
  });
}

export async function postponeInstallmentAction(input: PostponeInput): Promise<ActionResult> {
  return runAction(postponeSchema, input, async (d) => {
    await assertUser();
    if (d.newDate < todayISO()) return fail("A nova data deve ser hoje ou uma data futura.");
    const supabase = await createClient();
    const args: NullableArgs<Fns["postpone_installment"]["Args"]> = {
      p_installment_id: d.installmentId,
      p_new_date: d.newDate,
      p_reason: d.reason,
      p_notes: d.notes,
      p_expected_channel: d.expectedChannel,
      p_needs_visit: d.needsVisit,
    };
    const { error } = await supabase.rpc("postpone_installment", args as Fns["postpone_installment"]["Args"]);
    if (error) throw error;
    revalidateFinance();
    return ok(undefined, "Cobrança adiada.");
  });
}

export async function createPromiseAction(input: PromiseInput): Promise<ActionResult> {
  return runAction(promiseSchema, input, async (d) => {
    await assertUser();
    if (d.dueDate < todayISO()) return fail("A data combinada deve ser hoje ou futura.");
    const supabase = await createClient();
    const args: NullableArgs<Fns["create_promise"]["Args"]> = {
      p_customer_id: d.customerId,
      p_installment_id: d.installmentId,
      p_amount: d.amount,
      p_due_date: d.dueDate,
      p_expected_method: d.expectedMethod,
      p_notes: d.notes,
    };
    const { error } = await supabase.rpc("create_promise", args as Fns["create_promise"]["Args"]);
    if (error) throw error;
    revalidateFinance();
    return ok(undefined, "Promessa registrada.");
  });
}

export async function resolvePromiseAction(input: ResolvePromiseInput): Promise<ActionResult> {
  return runAction(resolvePromiseSchema, input, async (d) => {
    await assertUser();
    const supabase = await createClient();
    const args: NullableArgs<Fns["resolve_promise"]["Args"]> = {
      p_promise_id: d.promiseId,
      p_status: d.status,
      p_notes: d.notes,
    };
    const { error } = await supabase.rpc("resolve_promise", args as Fns["resolve_promise"]["Args"]);
    if (error) throw error;
    revalidateFinance();
    const msg = { kept: "Promessa marcada como cumprida.", broken: "Promessa marcada como não cumprida.", cancelled: "Promessa cancelada." };
    return ok(undefined, msg[d.status]);
  });
}

/** Registra o comprovante já enviado ao Storage (upload feito no navegador). */
export async function addReceiptAction(input: ReceiptInput): Promise<ActionResult<{ id: string }>> {
  return runAction(receiptSchema, input, async (d) => {
    const user = await assertUser();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("payment_receipts")
      .insert({
        payment_id: d.paymentId,
        storage_path: d.storagePath,
        file_name: d.fileName,
        mime_type: d.mimeType,
        size_bytes: d.sizeBytes,
        uploaded_by: user.id,
      })
      .select("id")
      .single();
    if (error) throw error;
    revalidateFinance();
    return ok({ id: data.id }, "Comprovante anexado.");
  });
}
