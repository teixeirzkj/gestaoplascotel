"use server";

import { revalidatePath } from "next/cache";
import { assertOwner } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { fail, ok, runAction, type ActionResult } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { cancelSaleSchema, createSaleSchema, customerSearchSchema, type CancelSaleInput, type CreateSaleInput } from "./schemas";
import { searchCustomerOptions, type CustomerOption } from "./queries";

const AFFECTED_PATHS = ["/", "/vendas", "/clientes", "/cobrancas", "/caixa"];

function revalidateSales(extra: string[] = []) {
  for (const p of [...AFFECTED_PATHS, ...extra]) revalidatePath(p);
  revalidatePath("/clientes/[id]", "page");
}

/** Registra a venda via RPC create_sale (transacional, idempotente, auditada). */
export async function createSale(input: CreateSaleInput): Promise<ActionResult<{ id: string }>> {
  return runAction(createSaleSchema, input, async (d) => {
    await assertOwner();
    if (d.sale_date > todayISO()) return fail("A data da venda não pode estar no futuro.");

    const supabase = await createClient();
    const payload = {
      customer_id: d.customer_id,
      city_id: d.city_id,
      sale_date: d.sale_date,
      discount: d.discount,
      down_payment: d.down_payment,
      down_payment_received: d.down_payment > 0 ? d.down_payment_received : false,
      down_payment_method: d.down_payment_method,
      payment_method: d.payment_method,
      conditions: d.conditions,
      notes: d.notes,
      idempotency_key: d.idempotency_key,
      items: d.items.map((i) => ({
        product_id: i.product_id,
        description: i.description,
        quantity: i.quantity,
        unit_price: i.unit_price,
        discount: i.discount,
      })),
      installments: d.installments.map((i) => ({ amount: i.amount, due_date: i.due_date })),
    };

    const { data, error } = await supabase.rpc("create_sale", { p: payload });
    if (error) return fail(error);
    if (!data) return fail("Não foi possível registrar a venda. Tente novamente.");

    revalidateSales([`/vendas/${data}`, `/clientes/${d.customer_id}`]);
    return ok({ id: data }, "Venda registrada com sucesso.");
  });
}

/** Cancela a venda (RPC cancel_sale bloqueia se houver pagamentos ativos). */
export async function cancelSale(input: CancelSaleInput): Promise<ActionResult> {
  return runAction(cancelSaleSchema, input, async (d) => {
    await assertOwner();
    const supabase = await createClient();
    const { error } = await supabase.rpc("cancel_sale", { p_sale_id: d.sale_id, p_reason: d.reason });
    if (error) return fail(error);
    revalidateSales([`/vendas/${d.sale_id}`]);
    return ok(undefined, "Venda cancelada.");
  });
}

/** Busca clientes ativos (nome ou telefone) para o seletor da nova venda. */
export async function searchCustomersAction(query: string): Promise<ActionResult<CustomerOption[]>> {
  return runAction(customerSearchSchema, query, async (q) => {
    await assertOwner();
    return ok(await searchCustomerOptions(q));
  });
}
