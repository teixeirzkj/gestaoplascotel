"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/supabase";

let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

/** Cliente Supabase do navegador (uploads de comprovantes, URLs assinadas). Respeita RLS. */
export function createClient() {
  if (!client) {
    client = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    );
  }
  return client;
}
