/** Começa com uma única "/", sem "/" ou "\" logo em seguida, e sem espaços (tab/CR/LF) nem barras invertidas. */
const INTERNAL_PATH = /^\/(?![/\\])[^\s\\]*$/;
const PROBE_ORIGIN = "http://local.invalid";

/**
 * Normaliza um destino de redirecionamento vindo do usuário (ex.: `?next=`) para um caminho interno.
 * Recusa `//host`, `/\host`, barras invertidas, espaços/tab/CR/LF e qualquer valor que resolva para outra origem.
 * Retorna `null` quando o valor não é um caminho interno seguro.
 */
export function safeInternalPath(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 2048 || !INTERNAL_PATH.test(raw)) return null;
  // Recusa controles e barras codificados (%00–%1F, %7F, %2F, %5C), usados para burlar validações de redirect
  if (/%(?:[01][0-9a-f]|7f|2f|5c)/i.test(raw)) return null;
  try {
    const u = new URL(raw, PROBE_ORIGIN);
    if (u.origin !== PROBE_ORIGIN) return null;
    return u.pathname + u.search + u.hash;
  } catch {
    return null;
  }
}
