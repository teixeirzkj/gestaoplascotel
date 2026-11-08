"use server";

import { revalidatePath } from "next/cache";
import { assertOwner } from "@/lib/auth";
import { fail, ok, runAction, type ActionResult } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { productSchema, type ProductInput } from "./schemas";

/** Cria ou atualiza um produto (somente proprietário; RLS também exige is_owner()). */
export async function saveProduct(input: ProductInput): Promise<ActionResult<{ id: string }>> {
  return runAction(productSchema, input, async (data) => {
    const user = await assertOwner();
    const supabase = await createClient();
    const values = {
      name: data.name,
      category: data.category,
      description: data.description,
      price: data.price,
      active: data.active,
    };

    if (data.id) {
      const { data: row, error } = await supabase.from("products").update(values).eq("id", data.id).select("id").maybeSingle();
      if (error) return fail(error);
      if (!row) return fail("Produto não encontrado.");
      revalidateProducts();
      return ok({ id: row.id }, "Produto atualizado.");
    }

    const { data: row, error } = await supabase
      .from("products")
      .insert({ ...values, created_by: user.id })
      .select("id")
      .single();
    if (error) return fail(error);
    revalidateProducts();
    return ok({ id: row.id }, "Produto cadastrado.");
  });
}

function revalidateProducts() {
  revalidatePath("/produtos");
  revalidatePath("/vendas/nova");
}
