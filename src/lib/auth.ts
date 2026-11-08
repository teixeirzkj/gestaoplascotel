import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

export type SessionUser = Profile & { isOwner: boolean };

/**
 * Usuário atual (deduplicado por requisição).
 * getClaims() verifica a assinatura do JWT (ES256) localmente com a JWKS do projeto — seguro e sem
 * ida extra ao servidor de Auth. O perfil (papel/ativo) é lido do banco a cada requisição, e o banco
 * revalida o JWT em toda consulta (RLS), então um usuário desativado perde o acesso imediatamente.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, active, created_at, updated_at")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) return null;
  return { ...(profile as Profile), isOwner: profile.role === "owner" && profile.active };
});

/** Exige usuário ativo; redireciona para /login caso contrário. Use em páginas/layouts. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.active) redirect("/login?inativo=1");
  return user;
}

/** Exige proprietário em páginas; funcionário é enviado ao dashboard com aviso. */
export async function requireOwnerPage(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.isOwner) redirect("/?acesso=negado");
  return user;
}

export class AuthError extends Error {}

/** Para Server Actions: lança erro (capturado por runAction) se não houver usuário ativo. */
export async function assertUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user || !user.active) throw new AuthError("Sessão expirada. Entre novamente.");
  return user;
}

/** Para Server Actions do proprietário. O banco (RLS/RPC) também valida — defesa em profundidade. */
export async function assertOwner(): Promise<SessionUser> {
  const user = await assertUser();
  if (!user.isOwner) throw new AuthError("Apenas o proprietário pode realizar esta operação.");
  return user;
}
