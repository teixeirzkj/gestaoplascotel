import { z } from "zod";
import { PAYMENT_METHOD_VALUES } from "@/lib/labels";

/** Regras compartilhadas entre cliente (validação prévia) e Server Actions (validação definitiva). */
export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
export const RECEIPT_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"] as const;
export type ReceiptMimeType = (typeof RECEIPT_MIME_TYPES)[number];

const id = z.guid("Identificador inválido.");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");
const method = z.enum(PAYMENT_METHOD_VALUES, "Forma de pagamento inválida.");
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres.`)
    .optional()
    .transform((v) => (v ? v : null));

const money = z
  .number("Informe um valor.")
  .positive("Informe um valor maior que zero.")
  .max(10_000_000, "Valor muito alto.")
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, "Use no máximo duas casas decimais.");

export const registerPaymentSchema = z.object({
  installmentId: id,
  amount: money,
  paidOn: isoDate,
  method,
  notes: optionalText(500),
  confirm: z.boolean(),
  idempotencyKey: id,
});
export type RegisterPaymentInput = z.input<typeof registerPaymentSchema>;

export const paymentIdSchema = z.object({ paymentId: id });

export const paymentReasonSchema = z.object({
  paymentId: id,
  reason: z.string().trim().min(3, "Informe o motivo.").max(500, "Use no máximo 500 caracteres."),
});

export const reverseSchema = z.object({
  paymentId: id,
  reason: z.string().trim().min(5, "Informe a justificativa (mínimo 5 caracteres).").max(500, "Use no máximo 500 caracteres."),
});

export const postponeSchema = z.object({
  installmentId: id,
  newDate: isoDate,
  reason: z.string().trim().min(3, "Informe o motivo do adiamento.").max(200, "Use no máximo 200 caracteres."),
  notes: optionalText(500),
  expectedChannel: method.nullable(),
  needsVisit: z.boolean(),
});
export type PostponeInput = z.input<typeof postponeSchema>;

export const promiseSchema = z.object({
  customerId: id,
  installmentId: id.nullable(),
  amount: money,
  dueDate: isoDate,
  expectedMethod: method.nullable(),
  notes: optionalText(500),
});
export type PromiseInput = z.input<typeof promiseSchema>;

export const resolvePromiseSchema = z.object({
  promiseId: id,
  status: z.enum(["kept", "broken", "cancelled"]),
  notes: optionalText(300),
});
export type ResolvePromiseInput = z.input<typeof resolvePromiseSchema>;

export const receiptSchema = z
  .object({
    paymentId: id,
    storagePath: z.string().max(300),
    fileName: z.string().trim().min(1).max(200),
    mimeType: z.enum(RECEIPT_MIME_TYPES, "Tipo de arquivo não permitido."),
    sizeBytes: z.number().int().positive().max(MAX_RECEIPT_BYTES, "Arquivo maior que 10 MB."),
  })
  .refine((v) => new RegExp(`^payments/${v.paymentId}/[A-Za-z0-9-]+\\.[a-z0-9]{2,5}$`).test(v.storagePath), {
    message: "Caminho de comprovante inválido.",
    path: ["storagePath"],
  });
export type ReceiptInput = z.input<typeof receiptSchema>;
