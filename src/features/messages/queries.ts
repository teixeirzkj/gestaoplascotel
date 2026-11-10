import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { addDays, todayISO } from "@/lib/dates";
import { tsToBahiaDate } from "@/lib/format";
import { num } from "@/lib/money";
import { buildPixPayload, normalizePixKey } from "@/lib/pix";
import { DEFAULT_MESSAGE_SETTINGS, messageSettingsSchema, renderTemplate, templateFor, type MessageKind, type MessageSettings } from "./config";
import { computeQueue, type MessageLog, type QueueCustomer, type QueueInstallment, type QueueItem } from "./queue";

export const getMessageSettings = cache(async (): Promise<{ settings: MessageSettings; company: string; updatedAt: string | null }> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("app_settings").select("key, value, updated_at").in("key", ["messages", "company"]);
  if (error) throw error;
  const raw = data?.find((r) => r.key === "messages");
  const companyRow = data?.find((r) => r.key === "company")?.value as { name?: string; pix_key?: string | null } | undefined;
  const merged = { ...DEFAULT_MESSAGE_SETTINGS, ...((raw?.value as object) ?? {}) } as MessageSettings;
  // Pix: se ainda não configurado aqui, aproveita a chave cadastrada nos dados da empresa
  if (!merged.pix?.key && companyRow?.pix_key) merged.pix = { ...DEFAULT_MESSAGE_SETTINGS.pix, ...merged.pix, key: companyRow.pix_key };
  const parsed = messageSettingsSchema.safeParse(merged);
  return { settings: parsed.success ? parsed.data : DEFAULT_MESSAGE_SETTINGS, company: companyRow?.name || "PLASCOTEL", updatedAt: raw?.updated_at ?? null };
});

export type RenderedQueueItem = QueueItem & { body: string; pixCode: string | null };

/** Fila de mensagens de hoje, já com textos prontos e Pix com o valor exato. */
export async function getMessageQueue(): Promise<{ items: RenderedQueueItem[]; today: string; pixConfigured: boolean; enabled: boolean }> {
  const supabase = await createClient();
  const today = todayISO();
  const { settings, company } = await getMessageSettings();
  const lookahead = addDays(today, settings.steps.before_due.days);

  const [instRes, promRes, payRes] = await Promise.all([
    supabase
      .from("v_installments")
      .select("id, customer_id, number, sale_code, remaining, pending_confirmation_amount, collection_date, original_due_date")
      .in("status", ["upcoming", "due_today", "overdue", "postponed"])
      .eq("customer_archived", false)
      .lte("collection_date", lookahead)
      .limit(5000),
    supabase.from("payment_promises").select("id, customer_id, amount, due_date").eq("status", "pending").eq("due_date", today).limit(1000),
    supabase.from("payments").select("id, customer_id, amount, paid_on").eq("status", "confirmed").gte("paid_on", addDays(today, -3)).limit(1000),
  ]);
  for (const r of [instRes, promRes, payRes]) if (r.error) throw r.error;

  const installments: QueueInstallment[] = (instRes.data ?? []).map((i) => ({
    id: i.id!, customer_id: i.customer_id!, number: i.number ?? 0, sale_code: i.sale_code ?? 0,
    remaining: num(i.remaining), pending_confirmation_amount: num(i.pending_confirmation_amount),
    collection_date: i.collection_date!, original_due_date: i.original_due_date!,
  }));
  const customerIds = [...new Set([...installments.map((i) => i.customer_id), ...(promRes.data ?? []).map((p) => p.customer_id), ...(payRes.data ?? []).map((p) => p.customer_id)])];

  let customers: QueueCustomer[] = [];
  let logs: MessageLog[] = [];
  if (customerIds.length) {
    const [custRes, optRes, logRes] = await Promise.all([
      supabase.from("v_customers").select("id, full_name, phone, whatsapp, city_name, balance").in("id", customerIds),
      supabase.from("customers").select("id, messages_opt_out").in("id", customerIds),
      supabase
        .from("customer_messages")
        .select("customer_id, installment_id, promise_id, payment_id, kind, ref_date, status, created_at")
        .in("customer_id", customerIds)
        .gte("created_at", new Date(Date.now() - 120 * 86_400_000).toISOString())
        .limit(10000),
    ]);
    if (custRes.error) throw custRes.error;
    if (optRes.error) throw optRes.error;
    const optOut = new Set((optRes.data ?? []).filter((o) => o.messages_opt_out).map((o) => o.id));
    if (logRes.error) throw logRes.error;
    customers = (custRes.data ?? []).map((c) => ({
      id: c.id!, full_name: c.full_name!, phone: c.whatsapp || c.phone, city_name: c.city_name,
      opt_out: optOut.has(c.id!), balance: num(c.balance),
    }));
    logs = (logRes.data ?? []).map((l) => ({
      customer_id: l.customer_id, installment_id: l.installment_id, promise_id: l.promise_id, payment_id: l.payment_id,
      kind: l.kind, ref_date: l.ref_date, status: l.status as "sent" | "skipped", created_on: tsToBahiaDate(l.created_at),
    }));
  }

  const items = computeQueue({
    today, settings, customers, installments,
    promises: (promRes.data ?? []).map((p) => ({ ...p, amount: num(p.amount) })),
    payments: (payRes.data ?? []).map((p) => ({ ...p, amount: num(p.amount) })),
    logs,
  });

  const pixKey = normalizePixKey(settings.pix.key);
  const rendered = items.map((it): RenderedQueueItem => {
    let pixCode: string | null = null;
    if (pixKey && it.kind !== "thanks" && it.amount > 0) {
      const txid = it.installments.length ? `V${it.installments[0].sale_code}P${it.installments[0].number}` : "***";
      pixCode = buildPixPayload({ key: pixKey.key, name: settings.pix.name, city: settings.pix.city, amount: it.amount, txid });
    }
    const body = renderTemplate(templateFor(settings, it.kind), {
      fullName: it.customer.full_name, company, amount: it.amount, dueDate: it.dueDate, daysOverdue: it.daysOverdue,
      balance: it.customer.balance, pixCode,
    }, it.kind);
    return { ...it, body, pixCode };
  });

  return { items: rendered, today, pixConfigured: Boolean(pixKey), enabled: settings.enabled };
}

export type MessageHistoryRow = {
  group_id: string;
  customer_id: string;
  customer_name: string;
  kind: MessageKind;
  status: "sent" | "skipped";
  skip_reason: string | null;
  amount: number | null;
  created_at: string;
  created_by_name: string | null;
};

/** Histórico agrupado (uma linha por mensagem) e indicadores dos últimos 30 dias. */
export async function getMessageHistory(): Promise<{
  rows: MessageHistoryRow[];
  stats: { sent7: number; sent30: number; skipped30: number; paidAfter: number; paidAfterRate: number | null };
}> {
  const supabase = await createClient();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("customer_messages")
    .select("group_id, customer_id, kind, status, skip_reason, amount, created_at, created_by, customers(full_name), profiles:created_by(full_name)")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) throw error;

  const groups = new Map<string, MessageHistoryRow>();
  for (const r of data ?? []) {
    if (groups.has(r.group_id)) continue;
    const cust = r.customers as unknown as { full_name: string } | null;
    const prof = r.profiles as unknown as { full_name: string } | null;
    groups.set(r.group_id, {
      group_id: r.group_id, customer_id: r.customer_id, customer_name: cust?.full_name ?? "—", kind: r.kind as MessageKind,
      status: r.status as "sent" | "skipped", skip_reason: r.skip_reason, amount: r.amount === null ? null : num(r.amount),
      created_at: r.created_at, created_by_name: prof?.full_name ?? null,
    });
  }
  const rows = [...groups.values()];
  const sentCharges = rows.filter((r) => r.status === "sent" && r.kind !== "thanks");
  const weekAgo = Date.now() - 7 * 86_400_000;

  // "Pagou depois do lembrete": pagamento confirmado do cliente em até 7 dias após a mensagem
  let paidAfter = 0;
  if (sentCharges.length) {
    const ids = [...new Set(sentCharges.map((r) => r.customer_id))];
    const { data: pays, error: pErr } = await supabase
      .from("payments")
      .select("customer_id, created_at")
      .eq("status", "confirmed")
      .in("customer_id", ids)
      .gte("created_at", since)
      .limit(5000);
    if (pErr) throw pErr;
    for (const m of sentCharges) {
      const t = new Date(m.created_at).getTime();
      if ((pays ?? []).some((p) => p.customer_id === m.customer_id && new Date(p.created_at).getTime() >= t && new Date(p.created_at).getTime() <= t + 7 * 86_400_000)) paidAfter++;
    }
  }

  return {
    rows: rows.slice(0, 200),
    stats: {
      sent7: rows.filter((r) => r.status === "sent" && new Date(r.created_at).getTime() >= weekAgo).length,
      sent30: rows.filter((r) => r.status === "sent").length,
      skipped30: rows.filter((r) => r.status === "skipped").length,
      paidAfter,
      paidAfterRate: sentCharges.length ? paidAfter / sentCharges.length : null,
    },
  };
}

/** Quantidade de mensagens pendentes hoje (para o dashboard). */
export async function getMessageQueueCount(): Promise<number> {
  try {
    return (await getMessageQueue()).items.length;
  } catch {
    return 0;
  }
}
