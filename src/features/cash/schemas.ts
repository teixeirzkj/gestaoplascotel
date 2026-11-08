import { z } from "zod";
import { PAYMENT_METHOD_VALUES } from "@/lib/labels";
import { isISODate, todayISO } from "@/lib/dates";

const businessDate = z
  .string()
  .refine(isISODate, "Data inválida.")
  .refine((v) => v <= todayISO(), "A data não pode ser futura.");

export const cashAdjustmentSchema = z.object({
  /** Valor com sinal: positivo = entrada, negativo = saída */
  amount: z
    .number({ error: "Informe o valor." })
    .refine((v) => v !== 0, "Informe um valor diferente de zero.")
    .refine((v) => Math.abs(v) <= 10_000_000, "Valor muito alto."),
  method: z.enum(PAYMENT_METHOD_VALUES, { error: "Selecione a forma." }),
  date: businessDate,
  justification: z
    .string()
    .trim()
    .min(5, "Justificativa obrigatória (mínimo 5 caracteres).")
    .max(500, "Justificativa muito longa (máximo 500 caracteres)."),
});
export type CashAdjustmentInput = z.input<typeof cashAdjustmentSchema>;

export const closeCashDaySchema = z.object({
  date: businessDate,
  /** null = dinheiro não contado (sem divergência registrada) */
  countedCash: z.number().min(0, "O valor contado não pode ser negativo.").max(10_000_000, "Valor muito alto.").nullable(),
  notes: z.string().trim().max(500, "Observações muito longas (máximo 500 caracteres).").default(""),
});
export type CloseCashDayInput = z.input<typeof closeCashDaySchema>;
