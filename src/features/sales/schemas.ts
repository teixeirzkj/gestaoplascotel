import { z } from "zod";
import { PAYMENT_METHOD_VALUES } from "@/lib/labels";
import { isISODate } from "@/lib/dates";
import { saleTotals, toMoneyCents } from "./calc";

const money = (label: string) =>
  z
    .number({ error: `${label}: valor inválido.` })
    .min(0, `${label} não pode ser negativo.`)
    .max(9_999_999_999, `${label} acima do permitido.`);

const isoDate = (msg: string) => z.string().refine(isISODate, msg);
const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label}: máximo de ${max} caracteres.`)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const saleItemSchema = z
  .object({
    product_id: z.uuid().nullable(),
    description: z.string().trim().max(200, "Descrição do item muito longa (máx. 200)."),
    quantity: z
      .number({ error: "Quantidade inválida." })
      .gt(0, "A quantidade deve ser maior que zero.")
      .max(999_999, "Quantidade acima do permitido.")
      .refine((v) => Math.abs(v * 1000 - Math.round(v * 1000)) < 1e-6, "Use no máximo 3 casas decimais na quantidade."),
    unit_price: money("Valor unitário"),
    discount: money("Desconto do item"),
  })
  .refine((i) => i.product_id || i.description.length > 0, { message: "Informe a descrição do item avulso.", path: ["description"] });

export const installmentInputSchema = z.object({
  amount: money("Parcela").gt(0, "Toda parcela deve ter valor maior que zero."),
  due_date: isoDate("Informe o vencimento de todas as parcelas."),
});

/** Espelha as regras de create_sale (o banco valida novamente). */
export const createSaleSchema = z
  .object({
    idempotency_key: z.uuid("Chave de idempotência inválida. Recarregue a página."),
    customer_id: z.uuid("Selecione o cliente."),
    city_id: z.uuid().nullable(),
    sale_date: isoDate("Data da venda inválida."),
    items: z.array(saleItemSchema).min(1, "Inclua ao menos um produto.").max(100, "Máximo de 100 itens por venda."),
    discount: money("Desconto geral"),
    down_payment: money("Entrada"),
    down_payment_received: z.boolean(),
    down_payment_method: z.enum(PAYMENT_METHOD_VALUES).nullable(),
    payment_method: z.enum(PAYMENT_METHOD_VALUES).nullable(),
    conditions: optionalText(500, "Condições"),
    notes: optionalText(2000, "Observações"),
    installments: z.array(installmentInputSchema).max(36, "Máximo de 36 parcelas."),
  })
  .superRefine((d, ctx) => {
    const t = saleTotals(
      d.items.map((i) => ({ quantity: i.quantity, unitCents: toMoneyCents(i.unit_price), discountCents: toMoneyCents(i.discount) })),
      toMoneyCents(d.discount),
    );
    t.lines.forEach((line, idx) => {
      if (line < 0) ctx.addIssue({ code: "custom", message: `Item ${idx + 1}: o desconto é maior que o valor do item.`, path: ["items", idx, "discount"] });
    });
    if (t.discountCents > t.subtotalCents) ctx.addIssue({ code: "custom", message: "O desconto geral é maior que o subtotal.", path: ["discount"] });
    if (t.totalCents <= 0) ctx.addIssue({ code: "custom", message: "O valor total da venda deve ser maior que zero.", path: ["items"] });
    const down = toMoneyCents(d.down_payment);
    if (down > t.totalCents) ctx.addIssue({ code: "custom", message: "A entrada não pode ser maior que o total.", path: ["down_payment"] });
    const sum = d.installments.reduce((acc, i) => acc + toMoneyCents(i.amount), 0);
    if (sum + down !== t.totalCents)
      ctx.addIssue({ code: "custom", message: "A soma da entrada e das parcelas difere do total da venda.", path: ["installments"] });
    if (d.down_payment_received && down > 0 && !d.down_payment_method && !d.payment_method)
      ctx.addIssue({ code: "custom", message: "Informe a forma de pagamento da entrada recebida.", path: ["down_payment_method"] });
  });

export type CreateSaleInput = z.input<typeof createSaleSchema>;

export const cancelSaleSchema = z.object({
  sale_id: z.uuid("Venda inválida."),
  reason: z.string().trim().min(5, "Informe o motivo do cancelamento (mínimo 5 caracteres).").max(500, "Motivo muito longo (máx. 500)."),
});

export type CancelSaleInput = z.input<typeof cancelSaleSchema>;

export const customerSearchSchema = z.string().trim().max(80, "Busca muito longa.");
