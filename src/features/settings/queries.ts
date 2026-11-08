import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile } from "@/types/database";
import { billingSchema, companySchema, type BillingSettings, type CompanySettings } from "./schemas";

export const DEFAULT_COMPANY: CompanySettings = { name: "PLASCOTEL", document: null, phone: null, pix_key: null };
export const DEFAULT_BILLING: BillingSettings = { default_interval_days: 30, due_soon_days: 3, visit_soon_days: 3 };

export type SettingsData = {
  company: CompanySettings;
  billing: BillingSettings;
  updatedAt: { company: string | null; billing: string | null };
};

export async function getSettings(): Promise<SettingsData> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("app_settings").select("key, value, updated_at").in("key", ["company", "billing"]);
  if (error) throw error;
  const row = (k: string) => data?.find((r) => r.key === k);
  const c = companySchema.safeParse({ ...DEFAULT_COMPANY, ...(row("company")?.value as object | undefined) });
  const b = billingSchema.safeParse({ ...DEFAULT_BILLING, ...(row("billing")?.value as object | undefined) });
  return {
    company: c.success ? c.data : DEFAULT_COMPANY,
    billing: b.success ? b.data : DEFAULT_BILLING,
    updatedAt: { company: row("company")?.updated_at ?? null, billing: row("billing")?.updated_at ?? null },
  };
}

export type ManagedUser = Profile & { last_sign_in_at: string | null; banned: boolean };

/** Perfis + último acesso (Auth Admin). Chame somente após requireOwnerPage(). */
export async function getUsers(): Promise<{ users: ManagedUser[]; authAvailable: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, active, created_at, updated_at")
    .order("active", { ascending: false })
    .order("role", { ascending: true })
    .order("full_name", { ascending: true });
  if (error) throw error;

  const auth = new Map<string, { last: string | null; banned: boolean }>();
  let authAvailable = true;
  try {
    const admin = createAdminClient();
    const { data: list, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) throw listError;
    for (const u of list.users) {
      const bannedUntil = (u as { banned_until?: string | null }).banned_until;
      auth.set(u.id, { last: u.last_sign_in_at ?? null, banned: Boolean(bannedUntil && new Date(bannedUntil) > new Date()) });
    }
  } catch {
    authAvailable = false;
  }

  return {
    users: (data ?? []).map((p) => ({
      ...(p as Profile),
      last_sign_in_at: auth.get(p.id)?.last ?? null,
      banned: auth.get(p.id)?.banned ?? false,
    })),
    authAvailable,
  };
}

export type EnvStatus = { name: string; label: string; present: boolean; serverOnly: boolean }[];

/** Presença das variáveis de ambiente (nunca expõe valores). */
export function getEnvStatus(): EnvStatus {
  return [
    { name: "NEXT_PUBLIC_SUPABASE_URL", label: "URL do Supabase", present: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL), serverOnly: false },
    {
      name: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      label: "Chave pública (publishable)",
      present: Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
      serverOnly: false,
    },
    { name: "SUPABASE_SECRET_KEY", label: "Chave secreta (gestão de usuários)", present: Boolean(process.env.SUPABASE_SECRET_KEY), serverOnly: true },
  ];
}
