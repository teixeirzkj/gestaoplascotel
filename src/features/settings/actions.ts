"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertOwner, assertUser } from "@/lib/auth";
import { fail, ok, runAction, type ActionResult } from "@/lib/actions";
import {
  billingSchema, companySchema, createUserSchema, profileNameSchema, resetPasswordSchema, setActiveSchema, updateRoleSchema,
  type BillingInput, type CompanyInput, type CreateUserInput,
} from "./schemas";

const BAN_FOREVER = "876000h";

function revalidateSettings() {
  revalidatePath("/configuracoes");
}

/** Mensagens do Supabase Auth Admin em português */
function authErrorMessage(err: { message?: string; code?: string; status?: number } | null | undefined): string {
  const msg = err?.message ?? "";
  if (err?.code === "email_exists" || /already (been )?registered|already exists/i.test(msg)) return "Já existe um usuário com este e-mail.";
  if (err?.code === "weak_password" || /password/i.test(msg)) return "Senha fraca: use ao menos 8 caracteres, misturando letras e números.";
  if (/invalid.*email/i.test(msg)) return "E-mail inválido.";
  if (/not found/i.test(msg)) return "Usuário não encontrado no serviço de autenticação.";
  return "Não foi possível concluir a operação no serviço de autenticação. Tente novamente.";
}

function adminOrFail() {
  try {
    return { admin: createAdminClient(), error: null };
  } catch {
    return { admin: null, error: "Chave secreta do Supabase (SUPABASE_SECRET_KEY) não configurada no servidor." };
  }
}

/* -------------------------------------------------------------------------- */
/* Empresa e cobrança                                                          */
/* -------------------------------------------------------------------------- */

export async function updateCompanySettingsAction(input: CompanyInput): Promise<ActionResult<null>> {
  return runAction(companySchema, input, async (data) => {
    const user = await assertOwner();
    const supabase = await createClient();
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "company", value: data, updated_by: user.id, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) return fail(error);
    revalidateSettings();
    return ok(null, "Dados da empresa salvos.");
  });
}

export async function updateBillingSettingsAction(input: BillingInput): Promise<ActionResult<null>> {
  return runAction(billingSchema, input, async (data) => {
    const user = await assertOwner();
    const supabase = await createClient();
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "billing", value: data, updated_by: user.id, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) return fail(error);
    revalidateSettings();
    // Avisos de vencimento/visita afetam notificações e dashboard
    revalidatePath("/");
    return ok(null, "Regras de cobrança salvas.");
  });
}

/* -------------------------------------------------------------------------- */
/* Usuários                                                                    */
/* -------------------------------------------------------------------------- */

export async function createUserAction(input: CreateUserInput): Promise<ActionResult<{ id: string }>> {
  return runAction(createUserSchema, input, async (data) => {
    await assertOwner();
    const { admin, error: adminError } = adminOrFail();
    if (!admin) return fail(adminError);
    const { data: created, error } = await admin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
      app_metadata: { role: data.role },
    });
    if (error || !created.user) return fail(authErrorMessage(error));
    revalidateSettings();
    return ok({ id: created.user.id }, `Usuário ${data.full_name} criado.`);
  });
}

export async function updateUserRoleAction(input: { userId: string; role: "owner" | "employee" }): Promise<ActionResult<null>> {
  return runAction(updateRoleSchema, input, async ({ userId, role }) => {
    await assertOwner();
    const supabase = await createClient();
    const { data, error } = await supabase.from("profiles").update({ role }).eq("id", userId).select("id");
    if (error) return fail(error);
    if (!data?.length) return fail("Usuário não encontrado ou sem permissão para alterar.");
    // Mantém o app_metadata em sincronia (informativo; a fonte do papel é a tabela profiles)
    const { admin } = adminOrFail();
    if (admin) await admin.auth.admin.updateUserById(userId, { app_metadata: { role } });
    revalidateSettings();
    revalidatePath("/", "layout");
    return ok(null, role === "owner" ? "Usuário agora é proprietário." : "Usuário agora é funcionário.");
  });
}

export async function setUserActiveAction(input: { userId: string; active: boolean }): Promise<ActionResult<null>> {
  return runAction(setActiveSchema, input, async ({ userId, active }) => {
    const me = await assertOwner();
    if (userId === me.id && !active) return fail("Você não pode desativar o seu próprio usuário.");
    const { admin, error: adminError } = adminOrFail();
    if (!admin) return fail(adminError);

    const supabase = await createClient();
    const { data, error } = await supabase.from("profiles").update({ active }).eq("id", userId).select("id");
    if (error) return fail(error);
    if (!data?.length) return fail("Usuário não encontrado ou sem permissão para alterar.");

    const { error: banError } = await admin.auth.admin.updateUserById(userId, { ban_duration: active ? "none" : BAN_FOREVER });
    revalidateSettings();
    if (banError) {
      return fail(
        active
          ? "Perfil reativado, mas o acesso no serviço de autenticação não foi liberado. Tente novamente."
          : "Perfil desativado (sem acesso aos dados), mas o bloqueio de login não foi aplicado. Tente novamente.",
      );
    }
    return ok(null, active ? "Usuário reativado." : "Usuário desativado e acesso bloqueado.");
  });
}

export async function resetUserPasswordAction(input: { userId: string; password: string }): Promise<ActionResult<null>> {
  return runAction(resetPasswordSchema, input, async ({ userId, password }) => {
    await assertOwner();
    const { admin, error: adminError } = adminOrFail();
    if (!admin) return fail(adminError);
    const { error } = await admin.auth.admin.updateUserById(userId, { password });
    if (error) return fail(authErrorMessage(error));
    return ok(null, "Senha redefinida. Envie a nova senha ao usuário.");
  });
}

/* -------------------------------------------------------------------------- */
/* Meu perfil                                                                  */
/* -------------------------------------------------------------------------- */

export async function updateMyNameAction(input: { full_name: string }): Promise<ActionResult<null>> {
  return runAction(profileNameSchema, input, async ({ full_name }) => {
    const user = await assertUser();
    const supabase = await createClient();
    const { error } = await supabase.from("profiles").update({ full_name }).eq("id", user.id);
    if (error) return fail(error);
    revalidatePath("/", "layout");
    return ok(null, "Nome atualizado.");
  });
}
