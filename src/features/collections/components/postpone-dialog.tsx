"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, MapPin } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import { formatBRL, formatDate, formatDateLong } from "@/lib/format";
import { addDays, addMonths, diffDays, startOfMonthISO, todayISO } from "@/lib/dates";
import type { PaymentMethod } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { InstallmentView } from "@/types/database";
import { postponeInstallmentAction } from "../actions";
import { installmentLabel } from "../messages";
import { DialogActions, MethodPicker, QuickChips, SuccessCheck, useAutoClose, useDialogLifecycle } from "./form-parts";

type Props = { open: boolean; onClose: () => void; installment: InstallmentView; onDone?: () => void };

const REASONS = ["Receberá salário", "Sem dinheiro no momento", "Viajando", "Pediu mais prazo"] as const;

/** Adiar a data de cobrança. O vencimento original é preservado no banco. */
export function PostponeDialog({ open, onClose, installment, onDone }: Props) {
  const { close, setBusy, markCompleted } = useDialogLifecycle(onClose, onDone);
  return (
    <Modal
      open={open}
      onClose={close}
      title="Adiar cobrança"
      description={
        <span>
          {installment.customer_name} · venda #{installment.sale_code} · {installmentLabel(installment.number)} ·{" "}
          <span className="money">{formatBRL(installment.remaining)}</span>
        </span>
      }
    >
      <PostponeForm installment={installment} close={close} setBusy={setBusy} markCompleted={markCompleted} />
    </Modal>
  );
}

function PostponeForm({
  installment: i,
  close,
  setBusy,
  markCompleted,
}: {
  installment: InstallmentView;
  close: () => void;
  setBusy: (b: boolean) => void;
  markCompleted: () => void;
}) {
  const today = todayISO();
  const nextMonth = addMonths(startOfMonthISO(today), 1);
  const shortcuts = [
    { label: "+7 dias", date: addDays(today, 7) },
    { label: "+15 dias", date: addDays(today, 15) },
    { label: "+30 dias", date: addDays(today, 30) },
    { label: "Dia 5", date: nextMonth.slice(0, 8) + "05" },
    { label: "Dia 10", date: nextMonth.slice(0, 8) + "10" },
    { label: "Dia 20", date: nextMonth.slice(0, 8) + "20" },
  ];

  const [newDate, setNewDate] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [channel, setChannel] = useState<PaymentMethod | null>(i.expected_channel ?? null);
  const [needsVisit, setNeedsVisit] = useState(i.needs_visit);
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useAutoClose(done !== null, close);

  const dateError = !newDate
    ? "Escolha a nova data."
    : newDate < today
      ? "A nova data deve ser hoje ou futura."
      : newDate === i.collection_date
        ? "A nova data é igual à data de cobrança atual."
        : undefined;
  const reasonError = reason.trim().length < 3 ? "Informe o motivo (mínimo 3 caracteres)." : undefined;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (dateError || reasonError || submitting) return;
    setSubmitting(true);
    setBusy(true);
    try {
      const r = await postponeInstallmentAction({
        installmentId: i.id,
        newDate,
        reason: reason.trim(),
        notes,
        expectedChannel: channel,
        needsVisit,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      markCompleted();
      toast.success(r.message ?? "Cobrança adiada.");
      setDone(newDate);
    } catch {
      toast.error("Falha de conexão. Tente novamente.");
    } finally {
      setSubmitting(false);
      setBusy(false);
    }
  }

  if (done) {
    return <SuccessCheck title="Cobrança adiada" description={`Nova data de cobrança: ${formatDateLong(done)} (${formatDate(done)}).`} />;
  }

  const days = newDate && !dateError ? diffDays(today, newDate) : null;

  return (
    <form onSubmit={submit} noValidate>
      {/* Datas: original preservada e atual que será substituída */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2">
        <div className="min-w-0 rounded-xl border border-line bg-card px-3 py-2.5">
          <p className="text-[11.5px] font-medium text-fg-muted">Cobrança atual</p>
          <p className="tabular mt-0.5 text-[15px] font-semibold text-fg line-through decoration-fg-subtle/60">
            {formatDate(i.collection_date)}
          </p>
          <p className="tabular mt-0.5 truncate text-[11.5px] text-fg-subtle">Venc. original {formatDate(i.original_due_date)}</p>
        </div>
        <span className="flex items-center text-fg-subtle" aria-hidden>
          <ArrowRight className="h-4 w-4" />
        </span>
        <div className={cn("min-w-0 rounded-xl px-3 py-2.5", newDate && !dateError ? "bg-paper text-paper-ink" : "border border-dashed border-line-strong")}>
          <p className={cn("text-[11.5px] font-medium", newDate && !dateError ? "text-paper-muted" : "text-fg-muted")}>Nova data</p>
          <p className="tabular mt-0.5 text-[15px] font-semibold">{newDate && !dateError ? formatDate(newDate) : "—"}</p>
          <p className={cn("mt-0.5 truncate text-[11.5px]", newDate && !dateError ? "text-paper-muted" : "text-fg-subtle")}>
            {days === null ? "escolha abaixo" : days === 0 ? "hoje" : `em ${days} dia${days > 1 ? "s" : ""}`}
          </p>
        </div>
      </div>
      <p className="mt-2 text-[12px] text-fg-subtle">O vencimento original continua registrado no histórico.</p>

      <div className="mt-4 space-y-4">
        <div className="flex flex-col gap-1.5">
          <Field label="Nova data de cobrança" required error={touched ? dateError : undefined}>
            <Input type="date" value={newDate} min={today} onChange={(e) => setNewDate(e.target.value)} className="tabular" data-autofocus />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            {shortcuts.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => setNewDate(s.date)}
                aria-pressed={newDate === s.date}
                className={cn(
                  "flex h-11 cursor-pointer flex-col items-center justify-center rounded-xl border text-[13px] font-medium leading-tight transition-colors active:scale-[0.97]",
                  newDate === s.date ? "border-bronze/60 bg-bronze-soft text-fg" : "border-line text-fg-muted hover:border-line-strong hover:text-fg",
                )}
              >
                {s.label}
                <span className="tabular text-[10.5px] font-normal text-fg-subtle">{formatDate(s.date).slice(0, 5)}</span>
              </button>
            ))}
          </div>
          <p className="text-[12px] text-fg-subtle">“Dia 5/10/20” = do próximo mês.</p>
        </div>

        <div className="flex flex-col gap-2">
          <Field label="Motivo" required error={touched ? reasonError : undefined}>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="Por que a cobrança foi adiada?" />
          </Field>
          <QuickChips options={REASONS} onPick={setReason} active={reason} />
        </div>

        <MethodPicker label="Canal esperado de pagamento" value={channel} onChange={setChannel} allowNone />

        <Checkbox
          checked={needsVisit}
          onChange={setNeedsVisit}
          label={
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-bronze" /> Precisa de visita presencial
            </span>
          }
          description="O cliente aparece na lista de visitas da cidade."
        />

        <Field label="Observação">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} placeholder="Opcional" />
        </Field>
      </div>

      <DialogActions>
        <Button variant="ghost" onClick={close} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" loading={submitting} size="lg">
          Adiar cobrança
        </Button>
      </DialogActions>
    </form>
  );
}
