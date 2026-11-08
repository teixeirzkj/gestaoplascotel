import { isISODate } from "@/lib/dates";
import { fromCents } from "@/lib/money";
import type { PaymentMethod } from "@/lib/labels";
import type { ActiveProductOption } from "@/features/products/queries";
import { defaultFirstDue, generatePlan, parseQuantity, saleTotals, toMilli, toMoneyCents, type IntervalKey, type PlanRow } from "../../calc";
import type { CreateSaleInput } from "../../schemas";
import type { CustomerOption } from "../../queries";

export const CUSTOM_ITEM = "__avulso";

export type ItemDraft = {
  key: string;
  /** "" = não escolhido · CUSTOM_ITEM = item avulso · id do produto */
  source: string;
  description: string;
  quantity: string;
  unitPrice: number;
  discount: number;
};

export type SaleMode = "avista" | "parcelado";

export type Draft = {
  customer: CustomerOption | null;
  cityId: string;
  saleDate: string;
  items: ItemDraft[];
  discount: number;
  paymentMethod: PaymentMethod | "";
  conditions: string;
  mode: SaleMode;
  cashReceived: boolean;
  cashMethod: PaymentMethod;
  down: number;
  downReceived: boolean;
  downMethod: PaymentMethod;
  count: number;
  interval: IntervalKey;
  /** null = automático (calculado pela data da venda + intervalo) */
  firstDue: string | null;
  /** null = parcelas geradas automaticamente; array = editadas manualmente */
  customRows: PlanRow[] | null;
  notes: string;
};

export function emptyItem(key: string): ItemDraft {
  return { key, source: "", description: "", quantity: "1", unitPrice: 0, discount: 0 };
}

export function initialDraft(today: string, customer: CustomerOption | null, interval: IntervalKey = "monthly"): Draft {
  return {
    customer,
    cityId: customer?.city_id ?? "",
    saleDate: today,
    items: [emptyItem("item-1")],
    discount: 0,
    paymentMethod: "",
    conditions: "",
    mode: "parcelado",
    cashReceived: true,
    cashMethod: "pix",
    down: 0,
    downReceived: true,
    downMethod: "pix",
    count: 3,
    interval,
    firstDue: null,
    customRows: null,
    notes: "",
  };
}

export type Computed = ReturnType<typeof computeDraft>;

export function computeDraft(d: Draft) {
  const parsedItems = d.items.map((it) => {
    const qty = parseQuantity(it.quantity);
    const validQty = Number.isFinite(qty) && qty > 0;
    return { qty, validQty, unitCents: toMoneyCents(it.unitPrice), discountCents: toMoneyCents(it.discount) };
  });
  const totals = saleTotals(
    parsedItems.map((p) => ({ quantity: p.validQty ? p.qty : 0, unitCents: p.unitCents, discountCents: p.discountCents })),
    toMoneyCents(d.discount),
  );
  const totalCents = totals.totalCents;
  const downCents = d.mode === "avista" ? totalCents : toMoneyCents(d.down);
  const baseCents = Math.max(0, totalCents - downCents);
  const saleDate = d.saleDate || "2000-01-01";
  const firstDue = d.firstDue ?? defaultFirstDue(saleDate, d.interval);
  // 1º vencimento automático: o dia da venda é a âncora mensal (31/01 => 28/02, 31/03…). Manual: o dia escolhido.
  const anchorDay = d.firstDue ? undefined : Number(saleDate.slice(8, 10));
  const rows: PlanRow[] = d.mode === "avista" ? [] : (d.customRows ?? generatePlan(baseCents, d.count, firstDue, d.interval, anchorDay));
  const rowsSum = rows.reduce((a, r) => a + r.amountCents, 0);
  const diffCents = d.mode === "avista" ? 0 : rowsSum - baseCents;
  return { parsedItems, ...totals, totalCents, downCents, baseCents, firstDue, rows, rowsSum, diffCents };
}

export type StepErrors = Record<string, string>;

export function validateStep(step: 1 | 2 | 3, d: Draft, c: Computed, today: string): StepErrors {
  const e: StepErrors = {};
  if (step === 1) {
    if (!d.customer) e.customer = "Selecione o cliente da venda.";
    if (!isISODate(d.saleDate)) e.saleDate = "Informe a data da venda.";
    else if (d.saleDate > today) e.saleDate = "A data da venda não pode estar no futuro.";
  }
  if (step === 2) {
    if (d.items.length === 0) e.items = "Inclua ao menos um produto.";
    d.items.forEach((it, i) => {
      const p = c.parsedItems[i];
      if (!it.source) e[`item.${it.key}.source`] = "Escolha um produto ou item avulso.";
      if (it.source === CUSTOM_ITEM && !it.description.trim()) e[`item.${it.key}.description`] = "Descreva o item avulso.";
      if (!p.validQty) e[`item.${it.key}.quantity`] = "Quantidade inválida.";
      else if (Math.abs(p.qty * 1000 - toMilli(p.qty)) > 1e-6) e[`item.${it.key}.quantity`] = "Máximo de 3 casas decimais.";
      else if (c.lines[i] < 0) e[`item.${it.key}.discount`] = "Desconto maior que o valor do item.";
    });
    if (c.discountCents > c.subtotalCents && c.subtotalCents >= 0) e.discount = "O desconto geral é maior que o subtotal.";
    else if (c.totalCents <= 0 && !Object.keys(e).some((k) => k.startsWith("item."))) e.total = "O valor total da venda deve ser maior que zero.";
  }
  if (step === 3) {
    if (d.mode === "parcelado") {
      if (c.totalCents > 0 && c.downCents >= c.totalCents)
        e.down = "A entrada deve ser menor que o total. Para pagamento integral, escolha “À vista”.";
      if (d.count < 1 || d.count > 36) e.count = "Escolha de 1 a 36 parcelas.";
      c.rows.forEach((r, i) => {
        if (r.amountCents <= 0) e[`row.${i}.amount`] = "Valor deve ser maior que zero.";
        if (!isISODate(r.dueDate)) e[`row.${i}.dueDate`] = "Informe o vencimento.";
        else if (isISODate(d.saleDate) && r.dueDate < d.saleDate) e[`row.${i}.dueDate`] = "Antes da data da venda.";
      });
      if (c.diffCents !== 0) e.rows = "A soma das parcelas precisa ser igual ao total menos a entrada.";
    }
  }
  return e;
}

export function buildPayload(d: Draft, c: Computed, products: ActiveProductOption[], idempotencyKey: string): CreateSaleInput {
  const byId = new Map(products.map((p) => [p.id, p]));
  const avista = d.mode === "avista";
  return {
    idempotency_key: idempotencyKey,
    customer_id: d.customer?.id ?? "",
    city_id: d.cityId || null,
    sale_date: d.saleDate,
    items: d.items.map((it, i) => {
      const custom = it.source === CUSTOM_ITEM;
      return {
        product_id: custom ? null : it.source || null,
        description: custom ? it.description.trim() : (byId.get(it.source)?.name ?? it.description.trim()),
        quantity: c.parsedItems[i].qty,
        unit_price: fromCents(c.parsedItems[i].unitCents),
        discount: fromCents(c.parsedItems[i].discountCents),
      };
    }),
    discount: fromCents(c.discountCents),
    down_payment: fromCents(c.downCents),
    down_payment_received: avista ? d.cashReceived : c.downCents > 0 && d.downReceived,
    down_payment_method: avista ? d.cashMethod : c.downCents > 0 ? d.downMethod : null,
    payment_method: d.paymentMethod || null,
    conditions: d.conditions.trim() || null,
    notes: d.notes.trim() || null,
    installments: c.rows.map((r) => ({ amount: fromCents(r.amountCents), due_date: r.dueDate })),
  };
}
