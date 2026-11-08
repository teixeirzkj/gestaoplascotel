import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.");
const optionalTime = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Horário inválido.")
  .or(z.literal(""))
  .optional()
  .default("");
const notes = z.string().trim().max(1000, "Observações muito longas (máx. 1000 caracteres).").optional().default("");

export const createVisitSchema = z.object({
  cityId: z.uuid("Selecione a cidade."),
  date: isoDate,
  time: optionalTime,
  notes,
  customerIds: z.array(z.uuid()).max(300, "Selecione no máximo 300 clientes.").default([]),
});
export type CreateVisitInput = z.input<typeof createVisitSchema>;

export const updateVisitSchema = z.object({
  id: z.uuid(),
  date: isoDate,
  time: optionalTime,
  notes,
});

export const VISIT_STATUS_VALUES = ["planned", "done", "cancelled"] as const;
export const setVisitStatusSchema = z.object({ id: z.uuid(), status: z.enum(VISIT_STATUS_VALUES) });

export const visitIdSchema = z.object({ id: z.uuid() });

export const addVisitCustomersSchema = z.object({
  visitId: z.uuid(),
  customerIds: z.array(z.uuid()).min(1, "Selecione ao menos um cliente.").max(300),
});

export const VISIT_CUSTOMER_STATUS_VALUES = ["to_visit", "visited", "not_found", "payment_received", "rescheduled"] as const;
export const setVisitCustomerStatusSchema = z.object({
  id: z.uuid(),
  status: z.enum(VISIT_CUSTOMER_STATUS_VALUES),
  notes: z.string().trim().max(1000, "Observação muito longa.").optional().default(""),
});

export const reorderStopsSchema = z.object({
  visitId: z.uuid(),
  orderedIds: z.array(z.uuid()).min(1).max(300),
});

export const cityIdSchema = z.uuid("Cidade inválida.");
