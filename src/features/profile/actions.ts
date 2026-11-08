"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertUser } from "@/lib/auth";
import { fail, ok, runAction, type ActionResult } from "@/lib/actions";

const nameSchema = z.object({ fullName: z.string().trim().min(2, "Informe seu nome.").max(120) });

export async function updateMyNameAction(input: z.infer<typeof nameSchema>): Promise<ActionResult<null>> {
  return runAction(nameSchema, input, async ({ fullName }) => {
    const user = await assertUser();
    const supabase = await createClient();
    const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", user.id);
    if (error) throw error;
    revalidatePath("/", "layout");
    return ok(null, "Nome atualizado.");
  });
}

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Informe a senha atual."),
    newPassword: z
      .string()
      .min(8, "A nova senha deve ter ao menos 8 caracteres.")
      .max(72, "A senha deve ter no máximo 72 caracteres.")
      .regex(/[A-Za-z]/, "Use ao menos uma letra.")
      .regex(/\d/, "Use ao menos um número."),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, { path: ["confirmPassword"], message: "As senhas não conferem." })
  .refine((d) => d.newPassword !== d.currentPassword, { path: ["newPassword"], message: "A nova senha deve ser diferente da atual." });

export async function changeMyPasswordAction(input: z.infer<typeof passwordSchema>): Promise<ActionResult<null>> {
  return runAction(passwordSchema, input, async ({ currentPassword, newPassword }) => {
    const user = await assertUser();
    if (!user.email) return fail("Usuário sem e-mail cadastrado.");
    const supabase = await createClient();
    // Confirma a senha atual antes de trocar (evita troca em sessão esquecida aberta)
    const { error: authError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
    if (authError) return { ok: false, error: "Senha atual incorreta.", fieldErrors: { currentPassword: "Senha atual incorreta." } };
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return fail(error.message.includes("different") ? "A nova senha deve ser diferente da atual." : "Não foi possível alterar a senha.");
    return ok(null, "Senha alterada com sucesso.");
  });
}
