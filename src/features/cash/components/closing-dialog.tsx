"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Checkbox, Field, MoneyInput, Textarea } from "@/components/ui/field";
import { useShellUser } from "@/components/layout/app-shell";
import { formatBRL, formatDate } from "@/lib/format";
import { fromCents, toCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import { closeCashDay } from "../actions";

export type Expected = { total: number; pix: number; cash: number; transfer: number; other: number };

/** Botão "Conferir caixa do dia" + modal de conferência (somente proprietário). */
export function ClosingButton({ date, expected, className }: { date: string; expected: Expected; className?: string }) {
  const { isOwner } = useShellUser();
  const [open, setOpen] = useState(false);
  if (!isOwner) return null;
  return (
    <>
      <Button variant="paper" size="lg" onClick={() => setOpen(true)} className={cn("w-full", className)}>
        <ClipboardCheck className="h-4 w-4" /> Conferir caixa do dia
      </Button>
      {open && <ClosingDialog open={open} onClose={() => setOpen(false)} date={date} expected={expected} />}
    </>
  );
}

function ClosingDialog({ open, onClose, date, expected }: { open: boolean; onClose: () => void; date: string; expected: Expected }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [countCash, setCountCash] = useState(true);
  const [counted, setCounted] = useState(0);
  const [notes, setNotes] = useState("");

  const divergence = countCash ? fromCents(toCents(counted) - toCents(expected.cash)) : 0;

  function submit() {
    startTransition(async () => {
      const r = await closeCashDay({ date, countedCash: countCash ? counted : null, notes });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(r.message ?? "Caixa conferido.");
      onClose();
      router.refresh();
    });
  }

  const rows: { label: string; value: number }[] = [
    { label: "Pix", value: expected.pix },
    { label: "Dinheiro", value: expected.cash },
    { label: "Transferência", value: expected.transfer },
    { label: "Outros", value: expected.other },
  ];

  return (
    <Modal
      open={open}
      onClose={() => !pending && onClose()}
      title={`Conferir caixa de ${formatDate(date)}`}
      description="Compare o dinheiro em mãos com o esperado pelo sistema. A conferência não pode ser desfeita."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={submit} loading={pending}>
            <ClipboardCheck className="h-4 w-4" /> Confirmar conferência
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-2xl bg-paper p-4 text-paper-ink">
          <p className="text-[12px] font-medium text-paper-muted">Esperado no dia</p>
          <p className="money mt-1 text-[26px] font-semibold leading-none tracking-tight">{formatBRL(expected.total)}</p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-paper-ink/10 pt-3 text-[13px]">
            {rows.map((r) => (
              <div key={r.label} className="flex items-center justify-between gap-2">
                <dt className="text-paper-muted">{r.label}</dt>
                <dd className="money font-medium">{formatBRL(r.value)}</dd>
              </div>
            ))}
          </dl>
        </div>

        <Checkbox
          checked={countCash}
          onChange={setCountCash}
          label="Contei o dinheiro em espécie"
          description="Desmarque se não houve contagem física; a divergência fica zerada."
        />

        {countCash && (
          <div className="space-y-2">
            <Field label="Dinheiro contado" hint={`Esperado em dinheiro: ${formatBRL(expected.cash)}`}>
              <MoneyInput value={counted} onValueChange={setCounted} data-autofocus />
            </Field>
            <div
              className={cn(
                "flex items-center justify-between rounded-xl border px-3.5 py-3 text-sm",
                divergence === 0 && "border-success/30 bg-success-soft",
                divergence > 0 && "border-warning/30 bg-warning-soft",
                divergence < 0 && "border-danger/30 bg-danger-soft",
              )}
              aria-live="polite"
            >
              <span className="text-fg-muted">
                {divergence === 0 ? "Sem divergência" : divergence > 0 ? "Sobra em dinheiro" : "Falta em dinheiro"}
              </span>
              <span
                className={cn(
                  "money font-semibold",
                  divergence === 0 && "text-success",
                  divergence > 0 && "text-warning",
                  divergence < 0 && "text-danger-fg",
                )}
              >
                {divergence > 0 ? "+" : ""}
                {formatBRL(divergence)}
              </span>
            </div>
          </div>
        )}

        <Field label="Observações" hint="Opcional. Ex.: motivo da divergência.">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} placeholder="Anotações da conferência" />
        </Field>
      </div>
    </Modal>
  );
}
