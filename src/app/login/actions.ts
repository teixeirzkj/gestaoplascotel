"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { safeInternalPath } from "@/lib/safe-redirect";
import { clientIp, loginWaitSeconds, recordLoginAttempt, waitMessage } from "@/lib/login-throttle";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido."),
  password: z.string().min(6, "A senha deve ter ao menos 6 caracteres."),
  next: z.string().optional(),
});

export type LoginState = { error?: string; fieldErrors?: { email?: string; password?: string }; email?: string };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) {
    const fe: LoginState["fieldErrors"] = {};
    for (const i of parsed.error.issues) fe[i.path[0] as "email" | "password"] ??= i.message;
    return { fieldErrors: fe, email: String(formData.get("email") ?? "") };
  }
  const ip = await clientIp();
  const wait = await loginWaitSeconds(parsed.data.email, ip);
  if (wait > 0) return { error: waitMessage(wait), email: parsed.data.email };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  if (error || !data.user) {
    await recordLoginAttempt(parsed.data.email, ip, false);
    // Mensagem genérica: não revela se o e-mail existe
    return { error: "E-mail ou senha incorretos.", email: parsed.data.email };
  }
  await recordLoginAttempt(parsed.data.email, ip, true);
  const { data: profile } = await supabase.from("profiles").select("active").eq("id", data.user.id).maybeSingle();
  if (!profile?.active) {
    await supabase.auth.signOut();
    return { error: "Seu acesso está desativado. Fale com o proprietário.", email: parsed.data.email };
  }
  // Somente caminhos internos (evita open redirect, inclusive via "/\host" e tab/CR/LF)
  redirect(safeInternalPath(parsed.data.next) ?? "/");
}
