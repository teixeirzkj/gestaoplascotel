import { z } from "zod";

/** Unidades federativas (padrão BA). */
export const BR_STATES = [
  { value: "AC", label: "Acre" },
  { value: "AL", label: "Alagoas" },
  { value: "AP", label: "Amapá" },
  { value: "AM", label: "Amazonas" },
  { value: "BA", label: "Bahia" },
  { value: "CE", label: "Ceará" },
  { value: "DF", label: "Distrito Federal" },
  { value: "ES", label: "Espírito Santo" },
  { value: "GO", label: "Goiás" },
  { value: "MA", label: "Maranhão" },
  { value: "MT", label: "Mato Grosso" },
  { value: "MS", label: "Mato Grosso do Sul" },
  { value: "MG", label: "Minas Gerais" },
  { value: "PA", label: "Pará" },
  { value: "PB", label: "Paraíba" },
  { value: "PR", label: "Paraná" },
  { value: "PE", label: "Pernambuco" },
  { value: "PI", label: "Piauí" },
  { value: "RJ", label: "Rio de Janeiro" },
  { value: "RN", label: "Rio Grande do Norte" },
  { value: "RS", label: "Rio Grande do Sul" },
  { value: "RO", label: "Rondônia" },
  { value: "RR", label: "Roraima" },
  { value: "SC", label: "Santa Catarina" },
  { value: "SP", label: "São Paulo" },
  { value: "SE", label: "Sergipe" },
  { value: "TO", label: "Tocantins" },
] as const;

const UF_VALUES = BR_STATES.map((s) => s.value) as [string, ...string[]];

export const citySchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2, "Informe o nome da cidade.").max(80, "Nome muito longo."),
  state: z.enum(UF_VALUES, { error: "Selecione a UF." }),
  notes: z.string().trim().max(1000, "Observações muito longas (máx. 1000 caracteres).").optional().default(""),
});
export type CityInput = z.input<typeof citySchema>;

export const cityArchiveSchema = z.object({
  id: z.uuid(),
  archived: z.boolean(),
});

/** Ordenações da lista de cidades */
export const CITY_SORTS = [
  { value: "pendente", label: "Maior pendente" },
  { value: "atraso", label: "Maior atraso" },
  { value: "nome", label: "Nome (A–Z)" },
  { value: "visita", label: "Visita mais antiga" },
] as const;
export type CitySort = (typeof CITY_SORTS)[number]["value"];
