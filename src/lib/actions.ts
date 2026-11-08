import "server-only";
import { z } from "zod";
import { AuthError } from "@/lib/auth";

/**
 * Padrão de retorno de TODAS as Server Actions.
 * Componentes cliente: `const r = await action(input); if (!r.ok) toast.error(r.error)`.
 */
export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

type PgLikeError = { message?: string; code?: string; details?: string; hint?: string };

/** Traduz erros do Postgres/Supabase para mensagens claras em português. */
export function friendlyDbError(err: PgLikeError | null | undefined): string {
  if (!err) return "Erro inesperado. Tente novamente.";
  const msg = err.message ?? "";
  // Mensagens das nossas RPCs (P0001 / 42501) já estão em português
  if (err.code === "P0001") return msg;
  if (err.code === "42501") {
    if (/row-level security|permission denied/i.test(msg)) return "Você não tem permissão para esta operação.";
    return msg;
  }
  if (err.code === "23505") return "Registro duplicado: já existe um cadastro com esses dados.";
  if (err.code === "23503") return "Registro vinculado a outro dado inexistente ou em uso.";
  if (err.code === "23514") return "Valores inválidos para esta operação.";
  if (err.code === "22P02") return "Formato de dado inválido.";
  if (/JWT|session/i.test(msg)) return "Sessão expirada. Entre novamente.";
  if (/fetch failed|network/i.test(msg)) return "Falha de conexão com o servidor. Verifique sua internet.";
  return "Não foi possível concluir a operação. Tente novamente.";
}

export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Valida a entrada com Zod e executa. Captura erros de auth/validação/banco. */
export async function runAction<S extends z.ZodType, T>(
  schema: S,
  input: unknown,
  fn: (data: z.infer<S>) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = zodFieldErrors(parsed.error);
    return { ok: false, error: Object.values(fieldErrors)[0] ?? "Dados inválidos.", fieldErrors };
  }
  try {
    return await fn(parsed.data);
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.message };
    // redirect()/notFound() do Next devem propagar
    if (e && typeof e === "object" && "digest" in e) throw e;
    console.error("[action]", e);
    return { ok: false, error: friendlyDbError(e as PgLikeError) };
  }
}

export function ok<T>(data: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}

export function fail(error: string | PgLikeError): ActionResult<never> {
  return { ok: false, error: typeof error === "string" ? error : friendlyDbError(error) };
}
