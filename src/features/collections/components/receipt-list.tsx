"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { ExternalLink, FileText, Loader2, Paperclip, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/states";
import { formatDateTime } from "@/lib/format";
import { listItem } from "@/lib/motion";
import { createClient } from "@/lib/supabase/client";
import { RECEIPT_ACCEPT, formatFileSize, openReceipt, uploadReceipt } from "./receipt-upload";

type ReceiptRow = {
  id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
};

type State = { status: "loading" } | { status: "error" } | { status: "ready"; rows: ReceiptRow[]; thumbs: Record<string, string> };

/** Comprovantes de um pagamento (bucket privado; abre por URL assinada de 60 s) + anexar novo. */
export function ReceiptList({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const supabase = createClient();
    (async () => {
      const { data, error } = await supabase
        .from("payment_receipts")
        .select("id, storage_path, file_name, mime_type, size_bytes, created_at")
        .eq("payment_id", paymentId)
        .order("created_at", { ascending: true });
      if (!alive) return;
      if (error) {
        setState({ status: "error" });
        return;
      }
      const rows = (data ?? []) as ReceiptRow[];
      // Miniaturas: URLs assinadas curtas só para imagens que o navegador renderiza (HEIC não).
      const imagePaths = rows.filter((r) => r.mime_type.startsWith("image/") && r.mime_type !== "image/heic").map((r) => r.storage_path);
      const thumbs: Record<string, string> = {};
      if (imagePaths.length) {
        const { data: signed } = await supabase.storage.from("receipts").createSignedUrls(imagePaths, 60);
        for (const s of signed ?? []) if (s.path && s.signedUrl) thumbs[s.path] = s.signedUrl;
      }
      if (alive) setState({ status: "ready", rows, thumbs });
    })().catch(() => {
      if (alive) setState({ status: "error" });
    });
    return () => {
      alive = false;
    };
  }, [paymentId, reloadKey]);

  const reload = useCallback(() => {
    setState({ status: "loading" });
    setReloadKey((k) => k + 1);
  }, []);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    const r = await uploadReceipt(paymentId, file);
    setUploading(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success("Comprovante anexado.");
    reload();
    router.refresh();
  }

  async function open(row: ReceiptRow) {
    setOpening(row.id);
    const err = await openReceipt(row.storage_path);
    setOpening(null);
    if (err) toast.error(err);
  }

  return (
    <div className="space-y-3">
      {state.status === "loading" && (
        <div className="space-y-2" role="status" aria-label="Carregando comprovantes">
          <Skeleton className="h-16 rounded-xl" />
        </div>
      )}
      {state.status === "error" && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-danger/25 bg-danger-soft px-3.5 py-3">
          <p className="text-[13px] text-fg">Não foi possível carregar os comprovantes.</p>
          <Button size="sm" variant="secondary" onClick={reload}>
            <RotateCw className="h-4 w-4" /> Tentar
          </Button>
        </div>
      )}
      {state.status === "ready" && state.rows.length === 0 && (
        <p className="rounded-xl border border-dashed border-line-strong px-3.5 py-4 text-center text-[13px] text-fg-muted">
          Nenhum comprovante anexado.
        </p>
      )}
      {state.status === "ready" && state.rows.length > 0 && (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {state.rows.map((row) => {
              const thumb = state.thumbs[row.storage_path];
              return (
                <motion.li key={row.id} variants={listItem} initial="hidden" animate="show" exit="exit" layout="position">
                  <button
                    type="button"
                    onClick={() => open(row)}
                    className="flex min-h-16 w-full cursor-pointer items-center gap-3 rounded-xl border border-line bg-card px-3 py-2.5 text-left transition-colors hover:border-line-strong hover:bg-card-hover"
                  >
                    <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-bronze-soft text-bronze">
                      {thumb ? (
                        // URL assinada temporária de bucket privado: next/image não se aplica aqui.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumb} alt={`Miniatura de ${row.file_name}`} className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <FileText className="h-5 w-5" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-fg">{row.file_name}</span>
                      <span className="block text-[12px] text-fg-muted">
                        {formatFileSize(row.size_bytes)} · {formatDateTime(row.created_at)}
                      </span>
                    </span>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center text-fg-muted" aria-hidden>
                      {opening === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                    </span>
                    <span className="sr-only">Abrir comprovante</span>
                  </button>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={RECEIPT_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <Button variant="outline" className="w-full" onClick={() => inputRef.current?.click()} loading={uploading}>
        {!uploading && <Paperclip className="h-4 w-4" />} {uploading ? "Enviando…" : "Anexar comprovante"}
      </Button>
      <p className="text-center text-[12px] text-fg-subtle">Imagem ou PDF até 10 MB. Comprovantes não podem ser apagados.</p>
    </div>
  );
}
