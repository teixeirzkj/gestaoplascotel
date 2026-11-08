import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres`)
    .transform((v) => (v === "" ? null : v))
    .nullable();

export const companySchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da empresa").max(120, "Máximo de 120 caracteres"),
  document: optionalText(30),
  phone: optionalText(20),
  pix_key: optionalText(120),
});
export type CompanyInput = z.input<typeof companySchema>;
export type CompanySettings = z.output<typeof companySchema>;

const days = (label: string, min: number, max: number) =>
  z.coerce
    .number({ error: `${label}: informe um número` })
    .int(`${label}: use um número inteiro`)
    .min(min, `${label}: mínimo ${min}`)
    .max(max, `${label}: máximo ${max}`);

export const billingSchema = z.object({
  default_interval_days: days("Intervalo entre parcelas", 1, 365),
  due_soon_days: days("Aviso de vencimento", 0, 30),
  visit_soon_days: days("Aviso de visita", 0, 30),
});
export type BillingInput = z.input<typeof billingSchema>;
export type BillingSettings = z.output<typeof billingSchema>;

export const ROLES = ["owner", "employee"] as const;

const password = z
  .string()
  .min(8, "A senha deve ter pelo menos 8 caracteres")
  .max(72, "A senha deve ter no máximo 72 caracteres");

export const createUserSchema = z.object({
  full_name: z.string().trim().min(2, "Informe o nome").max(120, "Máximo de 120 caracteres"),
  email: z.string().trim().toLowerCase().pipe(z.email("E-mail inválido")),
  password,
  role: z.enum(ROLES, { error: "Selecione o papel" }),
});
export type CreateUserInput = z.input<typeof createUserSchema>;

export const userIdSchema = z.uuid("Usuário inválido");

export const updateRoleSchema = z.object({ userId: userIdSchema, role: z.enum(ROLES) });
export const setActiveSchema = z.object({ userId: userIdSchema, active: z.boolean() });
export const resetPasswordSchema = z.object({ userId: userIdSchema, password });

export const profileNameSchema = z.object({
  full_name: z.string().trim().min(2, "Informe seu nome").max(120, "Máximo de 120 caracteres"),
});
