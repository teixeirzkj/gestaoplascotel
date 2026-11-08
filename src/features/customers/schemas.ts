import { z } from "zod";

/** Remove tudo que não for dígito (telefones são salvos só com dígitos). */
export function onlyDigits(v: string | null | undefined): string {
  return (v ?? "").replace(/\D/g, "");
}

const optionalText = (max: number, label: string) =>
  z.string().trim().max(max, `${label}: máximo de ${max} caracteres`);

const phoneText = (label: string) =>
  z
    .string()
    .trim()
    .refine((v) => {
      const d = onlyDigits(v);
      return d.length === 0 || d.length === 10 || d.length === 11;
    }, `${label} deve ter DDD + número (10 ou 11 dígitos)`);

/**
 * Formulário de cliente — usado no cliente (react-hook-form) e revalidado no servidor.
 * Os valores trafegam como texto; a action normaliza (dígitos, vazio => null).
 */
export const customerFormSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, "Informe o nome completo")
    .max(120, "Nome: máximo de 120 caracteres"),
  phone: phoneText("Telefone"),
  whatsapp: phoneText("WhatsApp"),
  city_id: z.union([z.literal(""), z.guid("Cidade inválida")]),
  neighborhood: optionalText(120, "Bairro"),
  address: optionalText(200, "Endereço"),
  reference: optionalText(200, "Referência"),
  notes: optionalText(2000, "Observações"),
});
export type CustomerFormValues = z.infer<typeof customerFormSchema>;

export const customerUpdateSchema = customerFormSchema.extend({ id: z.guid() });

export const archiveSchema = z.object({ id: z.guid(), archived: z.boolean() });

export const citySchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da cidade").max(80, "Nome da cidade muito longo"),
  state: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "UF deve ter 2 letras"),
});

export const NOTE_KINDS = ["note", "contact", "collection"] as const;

export const noteSchema = z.object({
  customer_id: z.guid(),
  kind: z.enum(NOTE_KINDS),
  body: z.string().trim().min(2, "Escreva a observação").max(2000, "Máximo de 2000 caracteres"),
});
export type NoteValues = z.infer<typeof noteSchema>;

export const activityPageSchema = z.object({
  customerId: z.guid(),
  offset: z.number().int().min(0).max(100_000),
});

/* ----------------------------- Parâmetros da listagem ----------------------------- */

export const CUSTOMER_SORTS = [
  { value: "nome", label: "Nome (A–Z)" },
  { value: "saldo", label: "Maior saldo" },
  { value: "atraso", label: "Maior atraso" },
  { value: "recentes", label: "Cadastro recente" },
] as const;
export type CustomerSort = (typeof CUSTOMER_SORTS)[number]["value"];

export const FINANCIAL_STATUSES = ["up_to_date", "pending", "overdue", "postponed", "paid_off", "no_sales"] as const;
export type FinancialStatusFilter = (typeof FINANCIAL_STATUSES)[number];

export const CUSTOMER_TABS = ["visao", "compras", "financeiro", "historico", "observacoes"] as const;
export type CustomerTab = (typeof CUSTOMER_TABS)[number];

export const PAGE_SIZE = 20;
export const ACTIVITY_PAGE_SIZE = 30;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

export type CustomerListParams = {
  q: string;
  cityId: string | null;
  status: FinancialStatusFilter | null;
  archived: boolean;
  sort: CustomerSort;
  page: number;
};

type RawParams = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function parseCustomerListParams(sp: RawParams): CustomerListParams {
  const q = first(sp.q).trim().slice(0, 80);
  const cidade = first(sp.cidade);
  const situacao = first(sp.situacao);
  const ordem = first(sp.ordem);
  const page = Number.parseInt(first(sp.page), 10);
  return {
    q,
    cityId: isUuid(cidade) ? cidade : null,
    status: (FINANCIAL_STATUSES as readonly string[]).includes(situacao) ? (situacao as FinancialStatusFilter) : null,
    archived: first(sp.arquivados) === "1",
    sort: CUSTOMER_SORTS.some((s) => s.value === ordem) ? (ordem as CustomerSort) : "nome",
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 10_000) : 1,
  };
}

export function parseTab(v: string | string[] | undefined): CustomerTab {
  const t = first(v);
  return (CUSTOMER_TABS as readonly string[]).includes(t) ? (t as CustomerTab) : "visao";
}
