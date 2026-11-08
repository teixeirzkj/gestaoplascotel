import {
  ArrowDownLeft, CalendarClock, CircleDollarSign, FileText, Handshake, MapPinned, MessageSquareText, Paperclip,
  PencilLine, Settings2, ShoppingBag, Undo2, Wallet, type LucideIcon,
} from "lucide-react";
import type { BadgeTone } from "@/components/ui/badge";

/**
 * Agrupamento das ações gravadas em activity_logs.action (ver supabase/migrations/*: log_activity/audit_row).
 * `filter` é um filtro PostgREST para `.or(...)`.
 */
export type ActivityGroupKey =
  | "vendas" | "pagamentos" | "estornos" | "adiamentos" | "promessas" | "observacoes"
  | "comprovantes" | "visitas" | "caixa" | "cadastros" | "usuarios";

type GroupMeta = { label: string; icon: LucideIcon; tone: BadgeTone; filter: string };

export const ACTIVITY_GROUPS: Record<ActivityGroupKey, GroupMeta> = {
  vendas: { label: "Vendas", icon: ShoppingBag, tone: "brand", filter: "action.in.(sale,sale_cancelled,sale_paid,sale_reopened)" },
  pagamentos: {
    label: "Pagamentos",
    icon: CircleDollarSign,
    tone: "success",
    filter: "action.in.(payment,payment_partial,payment_pending,payment_rejected,installment_paid)",
  },
  estornos: { label: "Estornos", icon: Undo2, tone: "danger", filter: "action.eq.payment_reversed" },
  adiamentos: { label: "Adiamentos", icon: CalendarClock, tone: "info", filter: "action.eq.postponement" },
  promessas: { label: "Promessas", icon: Handshake, tone: "warning", filter: "action.in.(promise,promise_kept,promise_broken,promise_cancelled)" },
  observacoes: { label: "Observações", icon: MessageSquareText, tone: "neutral", filter: "action.eq.note" },
  comprovantes: { label: "Comprovantes", icon: Paperclip, tone: "neutral", filter: "action.eq.receipt" },
  visitas: { label: "Visitas", icon: MapPinned, tone: "info", filter: "action.eq.visit,entity_type.eq.visits" },
  caixa: { label: "Caixa", icon: Wallet, tone: "warning", filter: "action.in.(cash_adjustment,cash_closing)" },
  cadastros: {
    label: "Cadastros e alterações",
    icon: PencilLine,
    tone: "neutral",
    filter: "and(action.in.(create,update,delete),entity_type.in.(customers,products,cities))",
  },
  usuarios: { label: "Usuários e configurações", icon: Settings2, tone: "muted", filter: "entity_type.in.(profiles,app_settings)" },
};

export const ACTIVITY_GROUP_OPTIONS = (Object.keys(ACTIVITY_GROUPS) as ActivityGroupKey[]).map((k) => ({
  value: k,
  label: ACTIVITY_GROUPS[k].label,
}));

export function isActivityGroup(v: unknown): v is ActivityGroupKey {
  return typeof v === "string" && v in ACTIVITY_GROUPS;
}

/** Grupo de uma ação registrada */
export function activityGroupOf(action: string, entityType: string | null): ActivityGroupKey | null {
  if (action.startsWith("sale")) return "vendas";
  if (action === "payment_reversed") return "estornos";
  if (action.startsWith("payment") || action === "installment_paid") return "pagamentos";
  if (action === "postponement") return "adiamentos";
  if (action.startsWith("promise")) return "promessas";
  if (action === "note") return "observacoes";
  if (action === "receipt") return "comprovantes";
  if (action === "visit" || entityType === "visits") return "visitas";
  if (action.startsWith("cash_")) return "caixa";
  if (entityType === "profiles" || entityType === "app_settings") return "usuarios";
  if (entityType && ["customers", "products", "cities"].includes(entityType)) return "cadastros";
  return null;
}

/** Rótulo curto da ação (mais específico que o grupo) */
const ACTION_LABEL: Record<string, string> = {
  sale: "Venda",
  sale_cancelled: "Venda cancelada",
  sale_paid: "Venda quitada",
  sale_reopened: "Venda reaberta",
  payment: "Pagamento",
  payment_partial: "Pagamento parcial",
  payment_pending: "Pagamento registrado",
  payment_rejected: "Pagamento não confirmado",
  payment_reversed: "Estorno",
  installment_paid: "Parcela quitada",
  postponement: "Adiamento",
  promise: "Promessa",
  promise_kept: "Promessa cumprida",
  promise_broken: "Promessa não cumprida",
  promise_cancelled: "Promessa cancelada",
  note: "Observação",
  receipt: "Comprovante",
  visit: "Visita",
  cash_adjustment: "Ajuste de caixa",
  cash_closing: "Conferência de caixa",
};

const ENTITY_LABEL: Record<string, string> = {
  customers: "Cliente",
  products: "Produto",
  cities: "Cidade",
  visits: "Visita",
  profiles: "Usuário",
  app_settings: "Configuração",
};

export function activityLabel(action: string, entityType: string | null): string {
  if (ACTION_LABEL[action]) return ACTION_LABEL[action];
  const entity = (entityType && ENTITY_LABEL[entityType]) || "Registro";
  if (action === "create") return `${entity} · cadastro`;
  if (action === "update") return `${entity} · alteração`;
  if (action === "delete") return `${entity} · remoção`;
  return entity;
}

export function activityIcon(action: string, entityType: string | null): LucideIcon {
  const g = activityGroupOf(action, entityType);
  if (!g) return FileText;
  if (g === "pagamentos" && action === "payment_pending") return ArrowDownLeft;
  return ACTIVITY_GROUPS[g].icon;
}

export function activityTone(action: string, entityType: string | null): BadgeTone {
  if (action === "payment_rejected" || action === "promise_broken" || action === "sale_cancelled") return "danger";
  if (action === "payment_pending") return "warning";
  const g = activityGroupOf(action, entityType);
  return g ? ACTIVITY_GROUPS[g].tone : "muted";
}

/** Link para a entidade relacionada (ou null quando não há página). */
export function activityHref(
  a: { action: string; entity_type: string | null; entity_id: string | null; customer_id: string | null },
  isOwner: boolean,
): string | null {
  const { entity_type: t, entity_id: id } = a;
  if (t === "sales" && id) return `/vendas/${id}`;
  if (t === "visits" && id && a.action !== "delete") return `/agenda/${id}`;
  if (t === "cities" && id) return `/cidades/${id}`;
  if (t === "products" && id) return `/produtos?editar=${id}`;
  if (a.customer_id) return `/clientes/${a.customer_id}`;
  if ((t === "cash_movements" || t === "cash_closings") && isOwner) return "/caixa";
  if ((t === "profiles" || t === "app_settings") && isOwner) return "/configuracoes";
  return null;
}
