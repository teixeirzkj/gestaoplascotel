/**
 * Pix "copia e cola" estático (BR Code / EMV MPM) com valor, conforme o Manual de Padrões para
 * Iniciação do Pix do Banco Central. Não depende de banco nem de API: o cliente cola no app do banco
 * e o valor e o recebedor já vêm preenchidos. (A confirmação do pagamento continua manual no sistema.)
 */

export type PixKeyType = "cpf" | "cnpj" | "phone" | "email" | "random";

function tlv(id: string, value: string): string {
  return id + String(value.length).padStart(2, "0") + value;
}

/** CRC16/CCITT-FALSE (polinômio 0x1021, inicial 0xFFFF), em hexadecimal maiúsculo com 4 dígitos. */
export function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Remove acentos e caracteres fora do padrão EMV (nome/cidade do recebedor). */
function sanitize(text: string, max: number): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .slice(0, max);
}

/** Identifica e normaliza a chave Pix. Retorna null se for inválida. */
export function normalizePixKey(raw: string | null | undefined): { key: string; type: PixKeyType } | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return { key: v.toLowerCase(), type: "email" };
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) return { key: v.toLowerCase(), type: "random" };
  const digits = v.replace(/\D/g, "");
  if (v.startsWith("+")) return digits.length >= 12 && digits.length <= 13 ? { key: "+" + digits, type: "phone" } : null;
  if (digits.length === 14) return { key: digits, type: "cnpj" };
  if (digits.length === 11) {
    // 11 dígitos pode ser CPF ou celular com DDD: CPF válido tem prioridade; senão, trata como telefone
    if (isValidCpf(digits)) return { key: digits, type: "cpf" };
    return { key: "+55" + digits, type: "phone" };
  }
  if (digits.length === 10) return { key: "+55" + digits, type: "phone" };
  return null;
}

function isValidCpf(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
}

export type PixPayloadInput = {
  key: string;
  name: string;
  city: string;
  amount?: number | null;
  /** Identificador da cobrança (até 25 caracteres alfanuméricos). "***" = sem identificador. */
  txid?: string;
  description?: string;
};

/** Gera o código Pix copia e cola. Lança erro se a chave for inválida. */
export function buildPixPayload({ key, name, city, amount, txid, description }: PixPayloadInput): string {
  const normalized = normalizePixKey(key);
  if (!normalized) throw new Error("Chave Pix inválida");
  const account = tlv("00", "br.gov.bcb.pix") + tlv("01", normalized.key) + (description ? tlv("02", sanitize(description, 40)) : "");
  const ref = (txid ?? "***").replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";
  let payload =
    tlv("00", "01") +
    tlv("26", account) +
    tlv("52", "0000") +
    tlv("53", "986") +
    (amount && amount > 0 ? tlv("54", amount.toFixed(2)) : "") +
    tlv("58", "BR") +
    tlv("59", sanitize(name, 25) || "RECEBEDOR") +
    tlv("60", sanitize(city, 15) || "BRASIL") +
    tlv("62", tlv("05", ref === "" ? "***" : ref));
  payload += "6304";
  return payload + crc16(payload);
}
