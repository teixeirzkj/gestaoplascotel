import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Limite de tentativas de login (força bruta). Regras no banco (login_throttle_check):
 * 5 falhas por e-mail ou 20 falhas por IP em 15 minutos bloqueiam por até 15 minutos.
 * E-mail e IP são guardados apenas como hash SHA-256.
 * Se o serviço estiver indisponível, não bloqueia (fail-open) para não trancar a equipe fora do sistema,
 * mas registra o problema no log do servidor. O Supabase Auth mantém seu próprio limite por IP.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  // Na Vercel, x-forwarded-for é definido pela borda; o primeiro valor é o IP real do cliente.
  return (h.get("x-forwarded-for")?.split(",")[0] || h.get("x-real-ip") || "desconhecido").trim().slice(0, 64);
}

export async function loginWaitSeconds(email: string, ip: string): Promise<number> {
  try {
    const { data, error } = await createAdminClient().rpc("login_throttle_check", { p_email: email, p_ip: ip });
    if (error) throw error;
    return typeof data === "number" ? data : 0;
  } catch (e) {
    console.error("[login-throttle] verificação indisponível", e);
    return 0;
  }
}

export async function recordLoginAttempt(email: string, ip: string, success: boolean): Promise<void> {
  try {
    const { error } = await createAdminClient().rpc("login_throttle_record", { p_email: email, p_ip: ip, p_success: success });
    if (error) throw error;
  } catch (e) {
    console.error("[login-throttle] registro indisponível", e);
  }
}

export function waitMessage(seconds: number): string {
  const min = Math.max(1, Math.ceil(seconds / 60));
  return `Muitas tentativas de acesso. Por segurança, aguarde ${min} minuto${min > 1 ? "s" : ""} e tente novamente.`;
}
