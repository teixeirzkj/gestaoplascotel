/**
 * Dinheiro no frontend: cálculos de PRÉ-VISUALIZAÇÃO sempre em CENTAVOS inteiros.
 * Os valores definitivos (saldos, quitação) são calculados e validados no banco (numeric(12,2)).
 */
export function toCents(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : Number(String(value).replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}

/** Divide um total (centavos) em N parcelas; a diferença de centavos vai para as primeiras. */
export function splitCents(totalCents: number, parts: number): number[] {
  if (parts <= 0) return [];
  const base = Math.floor(totalCents / parts);
  const remainder = totalCents - base * parts;
  return Array.from({ length: parts }, (_, i) => base + (i < remainder ? 1 : 0));
}

/** Converte texto da máscara BRL ("1.234,56") em número (1234.56). */
export function parseBRL(input: string): number {
  const digits = input.replace(/\D/g, "");
  if (!digits) return 0;
  return Number(digits) / 100;
}

/** Number vindo do Postgres (numeric chega como string ou number). */
export function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}
