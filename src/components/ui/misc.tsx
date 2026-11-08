"use client";

import { useState } from "react";
import { MessageCircle, Phone } from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { formatBRL, telLink, whatsappLink } from "@/lib/format";
import { Button } from "./button";
import { Modal } from "./modal";
import { Field, Textarea } from "./field";

export function Avatar({ name, className }: { name: string | null | undefined; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-bronze-soft text-[13px] font-semibold text-bronze",
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

/** Valor monetário com números tabulares */
export function Money({ value, className }: { value: number | string | null | undefined; className?: string }) {
  return <span className={cn("money whitespace-nowrap", className)}>{formatBRL(value)}</span>;
}

/** Botões de contato: WhatsApp (abre conversa, nunca dispara automaticamente) e ligação */
export function ContactButtons({
  phone,
  whatsapp,
  message,
  size = "icon-sm",
  className,
}: {
  phone?: string | null;
  whatsapp?: string | null;
  message?: string;
  size?: "icon-sm" | "icon";
  className?: string;
}) {
  const wa = whatsappLink(whatsapp || phone, message);
  const tel = telLink(phone || whatsapp);
  const cls = cn(
    "inline-flex shrink-0 items-center justify-center rounded-xl border border-line transition-colors",
    size === "icon" ? "h-11 w-11" : "h-9 w-9",
  );
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {wa && (
        <a href={wa} target="_blank" rel="noopener noreferrer" aria-label="Abrir WhatsApp" className={cn(cls, "text-success hover:bg-success-soft")}>
          <MessageCircle className="h-4 w-4" />
        </a>
      )}
      {tel && (
        <a href={tel} aria-label="Ligar" className={cn(cls, "text-fg-muted hover:bg-white/5 hover:text-fg")}>
          <Phone className="h-4 w-4" />
        </a>
      )}
    </div>
  );
}

/** Diálogo de confirmação; com requireReason exige justificativa (estornos, cancelamentos). */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirmar",
  tone = "primary",
  requireReason,
  reasonLabel = "Justificativa",
  minReason = 5,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  tone?: "primary" | "danger";
  requireReason?: boolean;
  reasonLabel?: string;
  minReason?: number;
  loading?: boolean;
}) {
  const [reason, setReason] = useState("");
  const invalid = requireReason && reason.trim().length < minReason;
  return (
    <Modal
      open={open}
      onClose={() => {
        if (!loading) {
          setReason("");
          onClose();
        }
      }}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Voltar
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            loading={loading}
            disabled={invalid}
            onClick={async () => {
              await onConfirm(reason.trim());
              setReason("");
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {requireReason ? (
        <Field label={reasonLabel} required hint={`Mínimo de ${minReason} caracteres. Fica registrado no histórico.`}>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Descreva o motivo" />
        </Field>
      ) : (
        <p className="text-sm text-fg-muted">Esta ação ficará registrada no histórico.</p>
      )}
    </Modal>
  );
}

/** Tabela base (desktop). No celular, prefira renderizar cards (md:hidden / hidden md:block). */
export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="relative overflow-x-auto">
      <table className={cn("w-full border-collapse text-sm", className)} {...props} />
    </div>
  );
}
export function Th({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "h-10 whitespace-nowrap border-b border-line px-4 text-left text-[12px] font-medium uppercase tracking-[0.06em] text-fg-subtle",
        className,
      )}
      {...props}
    />
  );
}
export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("h-14 border-b border-line px-4 align-middle text-fg", className)} {...props} />;
}
export function Tr({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("transition-colors hover:bg-white/[0.025]", className)} {...props} />;
}
