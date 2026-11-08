import type { BadgeTone } from "@/components/ui/badge";

export const PAYMENT_METHODS = [
  { value: "pix", label: "Pix" },
  { value: "cash", label: "Dinheiro" },
  { value: "transfer", label: "Transferência" },
  { value: "other", label: "Outro" },
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]["value"];
export const PAYMENT_METHOD_VALUES = ["pix", "cash", "transfer", "other"] as const;

export function methodLabel(m: string | null | undefined) {
  return PAYMENT_METHODS.find((x) => x.value === m)?.label ?? "—";
}

type StatusMeta = { label: string; tone: BadgeTone };

/** Situação financeira do cliente (calculada no banco: v_customers.financial_status) */
export const CUSTOMER_STATUS: Record<string, StatusMeta> = {
  up_to_date: { label: "Em dia", tone: "success" },
  pending: { label: "Com pendências", tone: "warning" },
  overdue: { label: "Atrasado", tone: "danger" },
  postponed: { label: "Adiado", tone: "info" },
  paid_off: { label: "Quitado", tone: "neutral" },
  no_sales: { label: "Sem compras", tone: "muted" },
};

/** Situação da parcela (v_installments.status) */
export const INSTALLMENT_STATUS: Record<string, StatusMeta> = {
  upcoming: { label: "A vencer", tone: "neutral" },
  due_today: { label: "Cobrar hoje", tone: "warning" },
  overdue: { label: "Atrasada", tone: "danger" },
  postponed: { label: "Adiada", tone: "info" },
  paid: { label: "Paga", tone: "success" },
  cancelled: { label: "Cancelada", tone: "muted" },
};

export const SALE_STATUS: Record<string, StatusMeta> = {
  open: { label: "Em aberto", tone: "warning" },
  paid: { label: "Quitada", tone: "success" },
  cancelled: { label: "Cancelada", tone: "muted" },
};

export const PAYMENT_STATUS: Record<string, StatusMeta> = {
  pending_confirmation: { label: "Aguardando confirmação", tone: "warning" },
  confirmed: { label: "Confirmado", tone: "success" },
  rejected: { label: "Não confirmado", tone: "muted" },
  reversed: { label: "Estornado", tone: "danger" },
};

/** Promessas: use v_promises.effective_status (pending vencida => broken) */
export const PROMISE_STATUS: Record<string, StatusMeta> = {
  pending: { label: "Pendente", tone: "warning" },
  kept: { label: "Cumprida", tone: "success" },
  broken: { label: "Não cumprida", tone: "danger" },
  cancelled: { label: "Cancelada", tone: "muted" },
};

export const VISIT_STATUS: Record<string, StatusMeta> = {
  planned: { label: "Planejada", tone: "info" },
  done: { label: "Realizada", tone: "success" },
  cancelled: { label: "Cancelada", tone: "muted" },
};

export const VISIT_CUSTOMER_STATUS: Record<string, StatusMeta> = {
  to_visit: { label: "A visitar", tone: "neutral" },
  visited: { label: "Visitado", tone: "info" },
  not_found: { label: "Não encontrado", tone: "warning" },
  payment_received: { label: "Pagamento recebido", tone: "success" },
  rescheduled: { label: "Nova data combinada", tone: "info" },
};

export const NOTE_KIND: Record<string, string> = {
  note: "Observação",
  contact: "Contato",
  collection: "Cobrança",
};

export const ROLE_LABEL: Record<string, string> = { owner: "Proprietário", employee: "Funcionário" };

export const CASH_KIND: Record<string, StatusMeta> = {
  payment: { label: "Recebimento", tone: "success" },
  reversal: { label: "Estorno", tone: "danger" },
  adjustment: { label: "Ajuste", tone: "warning" },
};
