import { diffDays } from "@/lib/dates";
import { MESSAGE_KINDS, type MessageKind, type MessageSettings } from "./config";

/**
 * Regras da fila de mensagens do dia (função pura, sem acesso a banco — testada em tests/unit).
 *
 * - Usa a DATA DE COBRANÇA (respeita adiamentos). Um adiamento reinicia o ciclo da parcela.
 * - Antes do vencimento: lembrete quando faltam 1..N dias (N configurável).
 * - No dia: "vence hoje". Atrasos: etapas de 3, 7 e 15 dias — envia a etapa mais avançada ainda não
 *   enviada; se o funcionário perdeu um dia, não reenvia etapas antigas; depois da última etapa, para.
 * - Promessa com data combinada hoje tem prioridade sobre as demais.
 * - No máximo UMA mensagem de cobrança por cliente por dia (agradecimentos são à parte).
 * - Ignora: cliente que pediu para não receber, sem telefone, parcelas com saldo já coberto por pagamento
 *   aguardando confirmação, e etapas já enviadas ou puladas.
 */

export type QueueInstallment = {
  id: string;
  customer_id: string;
  number: number;
  sale_code: number;
  remaining: number;
  pending_confirmation_amount: number;
  collection_date: string;
  original_due_date: string;
};

export type QueueCustomer = {
  id: string;
  full_name: string;
  phone: string | null;
  city_name: string | null;
  opt_out: boolean;
  balance: number;
};

export type QueuePromise = { id: string; customer_id: string; amount: number; due_date: string };
export type QueuePayment = { id: string; customer_id: string; amount: number; paid_on: string };

export type MessageLog = {
  customer_id: string;
  installment_id: string | null;
  promise_id: string | null;
  payment_id: string | null;
  kind: string;
  ref_date: string;
  status: "sent" | "skipped";
  /** Data de negócio (America/Bahia) em que foi registrada. */
  created_on: string;
};

export type QueueItem = {
  key: string;
  kind: MessageKind;
  customer: QueueCustomer;
  amount: number;
  /** Parcelas cobertas por esta mensagem (cobranças). */
  installments: { id: string; ref_date: string; number: number; sale_code: number; original_due_date: string }[];
  promiseId: string | null;
  paymentId: string | null;
  refDate: string;
  dueDate: string | null;
  daysOverdue: number;
};

const OVERDUE_STEPS: { kind: MessageKind; days: number }[] = [
  { kind: "overdue_15", days: 15 },
  { kind: "overdue_7", days: 7 },
  { kind: "overdue_3", days: 3 },
];

export function stepForInstallment(
  inst: QueueInstallment,
  today: string,
  settings: MessageSettings,
  logged: (kind: MessageKind, refDate: string) => boolean,
): MessageKind | null {
  const late = diffDays(inst.collection_date, today); // > 0 = dias de atraso pela data de cobrança
  const ref = inst.collection_date;
  if (late < 0) {
    const s = settings.steps.before_due;
    return s.enabled && -late <= s.days && !logged("before_due", ref) ? "before_due" : null;
  }
  if (late === 0) return settings.steps.due_today.enabled && !logged("due_today", ref) ? "due_today" : null;
  for (const st of OVERDUE_STEPS) {
    if (late < st.days) continue;
    if (logged(st.kind, ref)) return null; // já chegou nesta etapa: não volta para etapas anteriores
    if (settings.steps[st.kind].enabled) return st.kind;
  }
  return null;
}

export function computeQueue(input: {
  today: string;
  settings: MessageSettings;
  customers: QueueCustomer[];
  installments: QueueInstallment[];
  promises: QueuePromise[];
  payments: QueuePayment[];
  logs: MessageLog[];
}): QueueItem[] {
  const { today, settings } = input;
  if (!settings.enabled) return [];

  const customers = new Map(input.customers.map((c) => [c.id, c]));
  const instLog = new Set(input.logs.filter((l) => l.installment_id).map((l) => `${l.installment_id}|${l.kind}|${l.ref_date}`));
  const promiseLog = new Set(input.logs.filter((l) => l.promise_id).map((l) => `${l.promise_id}|${l.kind}`));
  const paymentLog = new Set(input.logs.filter((l) => l.payment_id).map((l) => `${l.payment_id}|${l.kind}`));
  const contactedToday = new Set(input.logs.filter((l) => l.status === "sent" && l.kind !== "thanks" && l.created_on === today).map((l) => l.customer_id));
  const eligible = (c: QueueCustomer | undefined): c is QueueCustomer => Boolean(c && !c.opt_out && c.phone && c.phone.replace(/\D/g, "").length >= 10);

  const items: QueueItem[] = [];

  // ---- Cobranças (uma por cliente por dia)
  type Candidate = { kind: MessageKind; inst: QueueInstallment };
  const byCustomer = new Map<string, Candidate[]>();
  for (const inst of input.installments) {
    if (inst.remaining - inst.pending_confirmation_amount <= 0.004) continue;
    const kind = stepForInstallment(inst, today, settings, (k, ref) => instLog.has(`${inst.id}|${k}|${ref}`));
    if (!kind) continue;
    const list = byCustomer.get(inst.customer_id) ?? [];
    list.push({ kind, inst });
    byCustomer.set(inst.customer_id, list);
  }

  const promisesToday = new Map<string, QueuePromise>();
  if (settings.steps.promise.enabled) {
    for (const p of input.promises) {
      if (p.due_date === today && !promiseLog.has(`${p.id}|promise`) && !promisesToday.has(p.customer_id)) promisesToday.set(p.customer_id, p);
    }
  }

  const customerIds = new Set([...byCustomer.keys(), ...promisesToday.keys()]);
  for (const cid of customerIds) {
    const customer = customers.get(cid);
    if (!eligible(customer) || contactedToday.has(cid)) continue;
    const promise = promisesToday.get(cid);
    if (promise) {
      items.push({
        key: `promise:${promise.id}`, kind: "promise", customer, amount: promise.amount, installments: [],
        promiseId: promise.id, paymentId: null, refDate: promise.due_date, dueDate: promise.due_date, daysOverdue: 0,
      });
      continue;
    }
    const cands = byCustomer.get(cid) ?? [];
    const top = MESSAGE_KINDS.find((k) => cands.some((c) => c.kind === k));
    if (!top) continue;
    const chosen = cands.filter((c) => c.kind === top).map((c) => c.inst).sort((a, b) => a.collection_date.localeCompare(b.collection_date));
    const amount = Math.round(chosen.reduce((s, i) => s + (i.remaining - i.pending_confirmation_amount), 0) * 100) / 100;
    items.push({
      key: `${top}:${cid}:${chosen.map((i) => i.id).join(",")}`,
      kind: top,
      customer,
      amount,
      installments: chosen.map((i) => ({ id: i.id, ref_date: i.collection_date, number: i.number, sale_code: i.sale_code, original_due_date: i.original_due_date })),
      promiseId: null,
      paymentId: null,
      refDate: chosen[0].collection_date,
      dueDate: chosen[0].collection_date,
      daysOverdue: Math.max(0, ...chosen.map((i) => diffDays(i.collection_date, today))),
    });
  }

  // ---- Agradecimentos (pagamentos confirmados nos últimos 3 dias)
  if (settings.steps.thanks.enabled) {
    const seen = new Set<string>();
    for (const p of input.payments) {
      const customer = customers.get(p.customer_id);
      if (!eligible(customer) || paymentLog.has(`${p.id}|thanks`) || seen.has(p.customer_id)) continue;
      if (diffDays(p.paid_on, today) > 3 || diffDays(p.paid_on, today) < 0) continue;
      seen.add(p.customer_id);
      items.push({
        key: `thanks:${p.id}`, kind: "thanks", customer, amount: p.amount, installments: [],
        promiseId: null, paymentId: p.id, refDate: p.paid_on, dueDate: null, daysOverdue: 0,
      });
    }
  }

  const order = (k: MessageKind) => MESSAGE_KINDS.indexOf(k);
  return items.sort((a, b) => order(a.kind) - order(b.kind) || b.daysOverdue - a.daysOverdue || a.customer.full_name.localeCompare(b.customer.full_name, "pt-BR"));
}
