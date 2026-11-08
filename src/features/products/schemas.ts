import { z } from "zod";

export const productSchema = z.object({
  id: z.uuid().optional().nullable(),
  name: z.string().trim().min(1, "Informe o nome do produto.").max(120, "Nome muito longo (máx. 120 caracteres)."),
  category: z
    .string()
    .trim()
    .max(60, "Categoria muito longa (máx. 60 caracteres).")
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  description: z
    .string()
    .trim()
    .max(1000, "Descrição muito longa (máx. 1000 caracteres).")
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  price: z
    .number({ error: "Informe o preço de venda." })
    .min(0, "O preço não pode ser negativo.")
    .max(9_999_999_999, "Preço acima do permitido.")
    .transform((v) => Math.round(v * 100) / 100),
  active: z.boolean(),
});

export type ProductInput = z.input<typeof productSchema>;
