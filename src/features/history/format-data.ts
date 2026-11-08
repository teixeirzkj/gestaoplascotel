import { formatBRL, formatDate, formatDateTime, formatPhone } from "@/lib/format";
import {
  CUSTOMER_STATUS, INSTALLMENT_STATUS, NOTE_KIND, PAYMENT_STATUS, PROMISE_STATUS, ROLE_LABEL, SALE_STATUS,
  VISIT_CUSTOMER_STATUS, VISIT_STATUS, methodLabel,
} from "@/lib/labels";

type Json = string | number | boolean | null | Json[] | { [key: string]: Json | undefined };

/** Tradução das chaves mais comuns gravadas em old_data/new_data */
const KEY_LABEL: Record<string, string> = {
  full_name: "Nome",
  name: "Nome",
  email: "E-mail",
  phone: "Telefone",
  whatsapp: "WhatsApp",
  neighborhood: "Bairro",
  address: "Endereço",
  reference: "Ponto de referência",
  notes: "Observações",
  state: "UF",
  category: "Categoria",
  description: "Descrição",
  price: "Preço",
  active: "Ativo",
  archived: "Arquivado(a)",
  archived_at: "Arquivado em",
  role: "Papel",
  status: "Situação",
  amount: "Valor",
  total: "Total",
  subtotal: "Subtotal",
  discount: "Desconto",
  down_payment: "Entrada",
  installments: "Parcelas",
  installments_count: "Parcelas",
  items: "Itens",
  method: "Forma de pagamento",
  expected_method: "Forma prevista",
  expected_channel: "Canal previsto",
  paid_on: "Pago em",
  due_date: "Data combinada",
  date: "Data",
  visit_date: "Data da visita",
  visit_time: "Horário",
  previous_date: "Data anterior",
  new_date: "Nova data",
  reason: "Motivo",
  needs_visit: "Visita presencial",
  kind: "Tipo",
  body: "Texto",
  file_name: "Arquivo",
  mime_type: "Tipo de arquivo",
  size_bytes: "Tamanho",
  last_contact_at: "Último contato",
  last_visit_date: "Última visita",
  next_visit_date: "Próxima visita",
  track_stock: "Controla estoque",
  stock_quantity: "Estoque",
  sku: "Código (SKU)",
  latitude: "Latitude",
  longitude: "Longitude",
  stop_order: "Ordem de parada",
  route_order: "Ordem na rota",
  // app_settings
  company: "Empresa",
  billing: "Cobrança",
  document: "Documento",
  pix_key: "Chave Pix",
  default_interval_days: "Intervalo padrão (dias)",
  due_soon_days: "Aviso de vencimento (dias)",
  visit_soon_days: "Aviso de visita (dias)",
};

/** Campos técnicos que não ajudam a leitura */
const HIDDEN_KEYS = new Set([
  "id", "created_at", "updated_at", "created_by", "updated_by", "uploaded_by", "storage_path", "idempotency_key",
]);

const MONEY_KEYS = new Set(["amount", "total", "subtotal", "discount", "down_payment", "price", "unit_price", "paid_amount"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

const STATUS_MAPS = [PAYMENT_STATUS, PROMISE_STATUS, SALE_STATUS, VISIT_STATUS, VISIT_CUSTOMER_STATUS, INSTALLMENT_STATUS, CUSTOMER_STATUS];

export function labelForKey(path: string): string {
  return path
    .split(".")
    .map((k) => KEY_LABEL[k] ?? k.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase()))
    .join(" › ");
}

export function formatValue(key: string, value: Json | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const leaf = key.split(".").pop() ?? key;
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (Array.isArray(value)) return value.length ? value.map((v) => formatValue(leaf, v)).join(", ") : "—";
  if (typeof value === "object") return JSON.stringify(value);
  if (MONEY_KEYS.has(leaf) && Number.isFinite(Number(value))) return formatBRL(Number(value));
  const s = String(value);
  if (leaf === "method" || leaf === "expected_method" || leaf === "expected_channel") return methodLabel(s);
  if (leaf === "role") return ROLE_LABEL[s] ?? s;
  if (leaf === "kind" && NOTE_KIND[s]) return NOTE_KIND[s];
  if (leaf === "status") {
    for (const m of STATUS_MAPS) if (m[s]) return m[s].label;
  }
  if (leaf === "phone" || leaf === "whatsapp") return formatPhone(s);
  if (leaf === "size_bytes" && Number.isFinite(Number(value))) return `${(Number(value) / 1024).toFixed(0)} KB`;
  if (leaf === "visit_time") return s.slice(0, 5);
  if (DATE.test(s)) return formatDate(s);
  if (TIMESTAMP.test(s)) return formatDateTime(s);
  return s;
}

/** Achata objetos aninhados (ex.: app_settings { company: { name } } → "company.name"). */
function flatten(obj: Json | null | undefined, prefix = "", out: Record<string, Json> = {}): Record<string, Json> {
  if (obj === null || obj === undefined || typeof obj !== "object" || Array.isArray(obj)) {
    if (prefix) out[prefix] = (obj ?? null) as Json;
    return out;
  }
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, path, out);
    else out[path] = v;
  }
  return out;
}

export type DiffRow = { key: string; label: string; before: string | null; after: string | null; changed: boolean };

/** Linhas legíveis "campo → antes / depois" a partir de old_data e new_data. */
export function buildDiff(oldData: unknown, newData: unknown): DiffRow[] {
  const o = flatten(oldData as Json);
  const n = flatten(newData as Json);
  const hasOld = oldData !== null && oldData !== undefined;
  const hasNew = newData !== null && newData !== undefined;
  const keys = [...new Set([...Object.keys(n), ...Object.keys(o)])];
  const rows: DiffRow[] = [];
  for (const key of keys) {
    const leaf = key.split(".").pop() ?? key;
    if (HIDDEN_KEYS.has(leaf) || leaf.endsWith("_id")) continue;
    const ov = o[key];
    const nv = n[key];
    if ((typeof ov === "string" && UUID.test(ov)) || (typeof nv === "string" && UUID.test(nv))) continue;
    const before = hasOld && key in o ? formatValue(key, ov) : null;
    const after = hasNew && key in n ? formatValue(key, nv) : null;
    rows.push({ key, label: labelForKey(key), before, after, changed: hasOld && hasNew && before !== after });
  }
  return rows;
}
