"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input, MoneyInput, Select, Textarea } from "@/components/ui/field";
import { useShellUser } from "@/components/layout/app-shell";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/labels";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import { createCashAdjustment } from "../actions";

type Direction = "in" | "out";

/** Botão + modal de ajuste de caixa (somente proprietário). */
export function AdjustmentButton({ defaultDate, today, className }: { defaultDate: string; today: string; className?: string }) {
  const { isOwner } = useShellUser();
  const [open, setOpen] = useState(false);
  if (!isOwner) return null;
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} className={className}>
        <SlidersHorizontal className="h-4 w-4" /> Ajuste de caixa
      </Button>
      {open && <AdjustmentDialog open={open} onClose={() => setOpen(false)} defaultDate={defaultDate} today={today} />}
    </>
  );
}

function AdjustmentDialog({ open, onClose, defaultDate, today }: { open: boolean; onClose: () => void; defaultDate: string; today: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [direction, setDirection] = useState<Direction>("in");
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [date, setDate] = useState(defaultDate);
  const [justification, setJustification] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const signed = direction === "in" ? amount : -amount;

  function submit() {
    const local: Record<string, string> = {};
    if (!amount) local.amount = "Informe o valor.";
    if (!date || date > today) local.date = "Escolha uma data até hoje.";
    if (justification.trim().length < 5) local.justification = "Justificativa obrigatória (mínimo 5 caracteres).";
    setErrors(local);
    if (Object.keys(local).length) return;

    startTransition(async () => {
      const r = await createCashAdjustment({ amount: signed, method, date, justification });
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        toast.error(r.error);
        return;
      }
      toast.success(r.message ?? "Ajuste registrado.");
      onClose();
      router.refresh();
    });
  }

  return (
    <Modal
      open={open}
      onClose={() => !pending && onClose()}
      title="Ajuste de caixa"
      description="Registra uma entrada ou saída manual. Fica no histórico com a justificativa."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={submit} loading={pending} variant={direction === "out" ? "danger" : "primary"}>
            {direction === "in" ? "Registrar entrada" : "Registrar saída"}
            {amount > 0 && <span className="money opacity-80">· {formatBRL(amount)}</span>}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo do ajuste">
          {(
            [
              { v: "in", label: "Entrada", icon: ArrowDownLeft, cls: "border-success/40 bg-success-soft text-success" },
              { v: "out", label: "Saída", icon: ArrowUpRight, cls: "border-danger/40 bg-danger-soft text-danger-fg" },
            ] as const
          ).map((o) => {
            const active = direction === o.v;
            const Icon = o.icon;
            return (
              <button
                key={o.v}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setDirection(o.v)}
                className={cn(
                  "flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition-colors",
                  active ? o.cls : "border-line bg-bg text-fg-muted hover:text-fg",
                )}
              >
                <Icon className="h-4 w-4" /> {o.label}
              </button>
            );
          })}
        </div>

        <Field label="Valor" required error={errors.amount}>
          <MoneyInput value={amount} onValueChange={setAmount} data-autofocus />
        </Field>

        <div className="grid grid-cols-1 gap-4 xs:grid-cols-2">
          <Field label="Forma" required error={errors.method}>
            <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Data" required error={errors.date}>
            <Input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>

        <Field label="Justificativa" required error={errors.justification} hint="Mínimo de 5 caracteres. Ex.: troco inicial, sangria, correção de lançamento.">
          <Textarea value={justification} onChange={(e) => setJustification(e.target.value)} maxLength={500} placeholder="Explique o motivo do ajuste" />
        </Field>
      </div>
    </Modal>
  );
}
