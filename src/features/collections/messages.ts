import { formatBRL, formatDate } from "@/lib/format";
import { num } from "@/lib/money";
import type { InstallmentView } from "@/types/database";

/** "Entrada" para number = 0, senão "Parcela N". */
export function installmentLabel(number: number, short = false): string {
  if (number === 0) return "Entrada";
  return short ? `${number}ª` : `Parcela ${number}`;
}

function firstName(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? "";
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

/**
 * Mensagem educada de cobrança pré-preenchida no WhatsApp.
 * Apenas abre a conversa no aparelho do usuário — nunca é enviada automaticamente.
 */
export function collectionMessage(i: Pick<InstallmentView, "customer_name" | "number" | "sale_code" | "remaining" | "collection_date" | "status">): string {
  const ref = i.number === 0 ? `a entrada da compra #${i.sale_code}` : `a parcela ${i.number} da compra #${i.sale_code}`;
  const value = formatBRL(num(i.remaining));
  const when =
    i.status === "overdue"
      ? `que estava prevista para ${formatDate(i.collection_date)}`
      : i.status === "due_today"
        ? "com vencimento para hoje"
        : `com vencimento em ${formatDate(i.collection_date)}`;
  return (
    `Olá, ${firstName(i.customer_name)}! Tudo bem? Aqui é da PLASCOTEL. ` +
    `Passando para lembrar ${ref}, no valor de ${value}, ${when}. ` +
    `Se já tiver pago, por favor desconsidere ou nos envie o comprovante por aqui. Obrigado!`
  );
}
