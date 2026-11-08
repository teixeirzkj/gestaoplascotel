/**
 * CSV compatível com Excel pt-BR: separador ";", BOM UTF-8, CRLF, decimais com vírgula e datas DD/MM/AAAA.
 */
import { formatDate } from "@/lib/format";
import { num } from "@/lib/money";

export type CsvCell = string | number | null | undefined | { money: number | string | null | undefined } | { date: string | null | undefined };

const SEP = ";";
const BOM = "﻿";

/** Número com vírgula decimal e sem separador de milhar (o Excel pt-BR reconhece como número). */
export function csvMoney(v: number | string | null | undefined): string {
  return num(v).toFixed(2).replace(".", ",");
}

function cellText(c: CsvCell): string {
  if (c === null || c === undefined) return "";
  if (typeof c === "number") return Number.isInteger(c) ? String(c) : String(c).replace(".", ",");
  if (typeof c === "object") {
    if ("money" in c) return csvMoney(c.money);
    return c.date ? formatDate(c.date) : "";
  }
  // Evita injeção de fórmula no Excel em campos de texto livre
  return /^[=+\-@\t\r]/.test(c) ? `'${c}` : c;
}

function escape(text: string): string {
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: CsvCell[][]): string {
  const lines = [header, ...rows].map((r) => r.map((c) => escape(cellText(c))).join(SEP));
  return BOM + lines.join("\r\n") + "\r\n";
}
