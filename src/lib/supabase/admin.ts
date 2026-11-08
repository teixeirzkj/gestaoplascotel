import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "@/types/supabase";

/**
 * Cliente administrativo (chave secreta). IGNORA RLS.
 * Uso exclusivo em Server Actions do proprietário (ex.: criar usuários), SEMPRE após requireOwner().
 */
export function createAdminClient() {
  if (!env.supabaseSecretKey) {
    throw new Error("SUPABASE_SECRET_KEY não configurada no servidor.");
  }
  return createClient<Database>(env.supabaseUrl, env.supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
