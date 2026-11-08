"use client";

import { useCallback, useEffect, useId, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeftRight, Banknote, CircleEllipsis, FileText, ImageIcon, Paperclip, QrCode, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/labels";
import { ease, spring } from "@/lib/motion";
import { RECEIPT_ACCEPT, formatFileSize } from "./receipt-upload";

const METHOD_ICON: Record<PaymentMethod, React.ComponentType<{ className?: string }>> = {
  pix: QrCode,
  cash: Banknote,
  transfer: ArrowLeftRight,
  other: CircleEllipsis,
};

/** Forma de pagamento em botões grandes (alvos ≥48px), 2 colunas no celular e 4 no desktop. */
export function MethodPicker({
  value,
  onChange,
  label,
  allowNone,
}: {
  value: PaymentMethod | null;
  onChange: (v: PaymentMethod | null) => void;
  label: string;
  /** Permite desmarcar (campo opcional) */
  allowNone?: boolean;
}) {
  const labelId = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <span id={labelId} className="text-[13px] font-medium text-fg-muted">
        {label}
      </span>
      <div role="radiogroup" aria-labelledby={labelId} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PAYMENT_METHODS.map((m) => {
          const Icon = METHOD_ICON[m.value];
          const active = value === m.value;
          return (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(active && allowNone ? null : m.value)}
              className={cn(
                "relative flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border text-sm font-medium transition-colors",
                active ? "border-bronze/60 text-fg" : "border-line bg-bg-elevated text-fg-muted hover:border-line-strong hover:text-fg",
              )}
            >
              {active && <motion.span layoutId={`${labelId}-pill`} transition={spring} className="absolute inset-0 rounded-xl bg-bronze-soft" />}
              <Icon className={cn("relative h-4 w-4", active && "text-bronze")} />
              <span className="relative">{m.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Chips de sugestão rápida (toque ≥40px de altura com espaçamento de 8px). */
export function QuickChips({ options, onPick, active }: { options: readonly string[]; onPick: (v: string) => void; active?: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onPick(o)}
          aria-pressed={active === o}
          className={cn(
            "inline-flex h-10 cursor-pointer items-center rounded-full border px-3.5 text-[13px] font-medium transition-colors active:scale-[0.97]",
            active === o ? "border-bronze/60 bg-bronze-soft text-fg" : "border-line text-fg-muted hover:border-line-strong hover:text-fg",
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

/** Seleção de comprovante: câmera/galeria/PDF no celular. */
export function ReceiptFileField({
  file,
  onChange,
  error,
}: {
  file: File | null;
  onChange: (file: File | null) => void;
  error?: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const isPdf = file ? file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf") : false;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-fg-muted">
        Comprovante <span className="font-normal text-fg-subtle">(opcional)</span>
      </label>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={RECEIPT_ACCEPT}
        className="sr-only"
        onChange={(e) => {
          onChange(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
      {file ? (
        <div className="flex min-h-14 items-center gap-3 rounded-xl border border-line-strong bg-bg-elevated px-3 py-2">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-bronze-soft text-bronze">
            {isPdf ? <FileText className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-fg">{file.name}</span>
            <span className="block text-[12px] text-fg-muted">{formatFileSize(file.size)}</span>
          </span>
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Remover comprovante"
            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg text-fg-muted hover:bg-white/5 hover:text-fg"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong text-sm font-medium text-fg-muted transition-colors hover:border-bronze/60 hover:text-fg"
        >
          <Paperclip className="h-4 w-4" /> Anexar foto ou PDF
        </button>
      )}
      {error ? (
        <p role="alert" className="text-[12px] font-medium text-danger-fg">
          {error}
        </p>
      ) : (
        <p className="text-[12px] text-fg-subtle">Imagem ou PDF até 10 MB. Anexar não confirma o recebimento.</p>
      )}
    </div>
  );
}

/** Rodapé fixo dentro do conteúdo do Modal (o formulário controla seus próprios botões). */
export function DialogActions({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "pb-safe sticky bottom-0 z-10 -mx-5 -mb-4 mt-5 flex flex-col-reverse gap-2 border-t border-line bg-bg-elevated px-5 py-3.5 sm:flex-row sm:justify-end",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Check animado de sucesso (círculo + traço desenhado). */
export function SuccessCheck({ title, description, children }: { title: string; description?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-2 py-6 text-center" role="status" aria-live="polite">
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 360, damping: 22 }}
        className="flex h-20 w-20 items-center justify-center rounded-full bg-success-soft"
      >
        <svg viewBox="0 0 52 52" className="h-12 w-12 text-success" aria-hidden>
          <motion.circle
            cx="26"
            cy="26"
            r="23"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            initial={{ pathLength: 0, opacity: 0.3 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.35, ease: ease.out }}
          />
          <motion.path
            d="M15 27l7 7 15-16"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.28, delay: 0.25, ease: ease.out }}
          />
        </svg>
      </motion.div>
      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.22 }}
        className="mt-4 text-[17px] font-semibold text-fg"
      >
        {title}
      </motion.p>
      {description && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.36, duration: 0.22 }}
          className="mt-1 max-w-xs text-[13px] leading-relaxed text-fg-muted"
        >
          {description}
        </motion.div>
      )}
      {children && <div className="mt-5 w-full">{children}</div>}
    </div>
  );
}

/**
 * onClose estável para o Modal (evita reexecutar o efeito de foco a cada render)
 * e que ignora o fechamento enquanto há uma operação em andamento.
 */
export function useDialogLifecycle(onClose: () => void, onDone?: () => void) {
  const router = useRouter();
  const handlers = useRef({ onClose, onDone });
  const busyRef = useRef(false);
  const completedRef = useRef(false);
  useEffect(() => {
    handlers.current = { onClose, onDone };
  }, [onClose, onDone]);
  /** Fecha (se não estiver ocupado). Se a operação foi concluída, atualiza os dados e chama onDone. */
  const close = useCallback(() => {
    if (busyRef.current) return;
    handlers.current.onClose();
    if (completedRef.current) {
      completedRef.current = false;
      handlers.current.onDone?.();
      router.refresh();
    }
  }, [router]);
  const setBusy = useCallback((busy: boolean) => {
    busyRef.current = busy;
  }, []);
  const markCompleted = useCallback(() => {
    completedRef.current = true;
  }, []);
  return { close, setBusy, markCompleted };
}

/** Fecha automaticamente após o feedback de sucesso. */
export function useAutoClose(active: boolean, close: () => void, delay = 1300) {
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(close, delay);
    return () => clearTimeout(t);
  }, [active, close, delay]);
}

/** Resumo compacto "rótulo / valor" usado no topo dos diálogos. */
export function SummaryTile({ label, value, tone = "default", className }: { label: string; value: React.ReactNode; tone?: "default" | "paper"; className?: string }) {
  return (
    <div className={cn("min-w-0 rounded-xl px-3 py-2.5", tone === "paper" ? "bg-paper text-paper-ink" : "border border-line bg-card", className)}>
      <p className={cn("text-[11.5px] font-medium", tone === "paper" ? "text-paper-muted" : "text-fg-muted")}>{label}</p>
      <div className="money mt-0.5 truncate text-[15px] font-semibold">{value}</div>
    </div>
  );
}
