"use client";

import { createClient } from "@/lib/supabase/client";
import { addReceiptAction } from "../actions";
import { MAX_RECEIPT_BYTES, RECEIPT_MIME_TYPES, type ReceiptMimeType } from "../schemas";

/** accept do input: no celular oferece câmera, galeria e arquivos. */
export const RECEIPT_ACCEPT = "image/*,application/pdf";

const EXT: Record<ReceiptMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "application/pdf": "pdf",
};

const BY_EXTENSION: Record<string, ReceiptMimeType> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heic",
  pdf: "application/pdf",
};

/** Resolve o tipo do arquivo (alguns celulares enviam HEIC sem MIME). */
export function receiptMime(file: File): ReceiptMimeType | null {
  const t = file.type.toLowerCase();
  if (t === "image/heif") return "image/heic";
  if ((RECEIPT_MIME_TYPES as readonly string[]).includes(t)) return t as ReceiptMimeType;
  if (!t || t === "application/octet-stream") {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    return BY_EXTENSION[ext] ?? null;
  }
  return null;
}

/** Valida tipo e tamanho; retorna a mensagem de erro ou null. */
export function validateReceiptFile(file: File): string | null {
  if (!receiptMime(file)) return "Envie uma imagem (JPG, PNG, WEBP, HEIC) ou um PDF.";
  if (file.size <= 0) return "Arquivo vazio.";
  if (file.size > MAX_RECEIPT_BYTES) return "O comprovante deve ter no máximo 10 MB.";
  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

export type UploadResult = { ok: true } | { ok: false; error: string };

/**
 * Envia o comprovante direto do navegador para o bucket privado "receipts"
 * (payments/<payment_id>/<uuid>.<ext>) e registra em payment_receipts via Server Action.
 */
export async function uploadReceipt(paymentId: string, file: File): Promise<UploadResult> {
  const invalid = validateReceiptFile(file);
  if (invalid) return { ok: false, error: invalid };
  const mime = receiptMime(file) as ReceiptMimeType;
  const path = `payments/${paymentId}/${crypto.randomUUID()}.${EXT[mime]}`;
  try {
    const supabase = createClient();
    const { error } = await supabase.storage.from("receipts").upload(path, file, { contentType: mime, upsert: false });
    if (error) {
      return { ok: false, error: /exceeded|size/i.test(error.message) ? "Arquivo maior que o permitido (10 MB)." : "Falha ao enviar o comprovante." };
    }
  } catch {
    return { ok: false, error: "Falha de conexão ao enviar o comprovante." };
  }
  const r = await addReceiptAction({
    paymentId,
    storagePath: path,
    fileName: file.name.slice(0, 200) || `comprovante.${EXT[mime]}`,
    mimeType: mime,
    sizeBytes: file.size,
  });
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

/**
 * Abre um comprovante privado via URL assinada (60 s).
 * A janela é aberta antes do await para não ser bloqueada como pop-up no celular.
 */
export async function openReceipt(storagePath: string): Promise<string | null> {
  const win = window.open("", "_blank");
  try {
    const supabase = createClient();
    const { data, error } = await supabase.storage.from("receipts").createSignedUrl(storagePath, 60);
    if (error || !data?.signedUrl) {
      win?.close();
      return "Não foi possível abrir o comprovante.";
    }
    if (win) {
      win.opener = null;
      win.location.href = data.signedUrl;
    } else {
      window.location.assign(data.signedUrl);
    }
    return null;
  } catch {
    win?.close();
    return "Falha de conexão ao abrir o comprovante.";
  }
}
