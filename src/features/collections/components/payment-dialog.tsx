"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Clock3 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, MoneyInput, Textarea } from "@/components/ui/field";
import { formatBRL, formatDate } from "@/lib/format";
import { todayISO } from "@/lib/dates";
import { fromCents, num, toCents } from "@/lib/money";
import { PAYMENT_STATUS, type PaymentMethod } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { InstallmentView } from "@/types/database";
import { registerPaymentAction } from "../actions";
import { installmentLabel } from "../messages";
import { DialogActions, MethodPicker, ReceiptFileField, SuccessCheck, SummaryTile, useAutoClose, useDialogLifecycle } from "./form-parts";
import { uploadReceipt, validateReceiptFile } from "./receipt-upload";

type Props = { open: boolean; onClose: () => void; installment: InstallmentView; onDone?: () => void };

/** Registrar recebimento (parcial ou total) de uma parcela, com comprovante opcional. */
export function PaymentDialog({ open, onClose, installment, onDone }: Props) {
  const { close, setBusy, markCompleted } = useDialogLifecycle(onClose, onDone);
  return (
    <Modal
      open={open}
      onClose={close}
      title="Registrar recebimento"
      description={
        <span>
          {installment.customer_name} · venda #{installment.sale_code} · {installmentLabel(installment.number)}
        </span>
      }
    >
      <PaymentForm installment={installment} close={close} setBusy={setBusy} markCompleted={markCompleted} />
    </Modal>
  );
}

/** O que o banco gravou (pode diferir do formulário num reenvio idempotente). */
type Saved = { paymentId: string; status: string; confirmed: boolean; amountCents: number; mismatch: boolean };

type Phase = { kind: "form" } | ({ kind: "success" } & Saved) | ({ kind: "receipt_failed"; error: string } & Saved);

function PaymentForm({
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
  const remainingCents = toCents(num(i.remaining));
  const pendingCents = toCents(num(i.pending_confirmation_amount));
  const availableCents = Math.max(0, remainingCents - pendingCents);

  // A chave de idempotência nasce quando o diálogo abre (o formulário monta junto com o Modal).
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [amount, setAmount] = useState<number>(fromCents(availableCents));
  const [paidOn, setPaidOn] = useState(today);
  const [method, setMethod] = useState<PaymentMethod>(i.expected_channel ?? "pix");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [confirmOverride, setConfirmOverride] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: "form" });
  // Após uma falha de conexão o 1º envio pode ter sido gravado com esta chave: os dados ficam travados
  // para que o reenvio não "mude" um pagamento que o banco não vai alterar.
  const [locked, setLocked] = useState(false);

  // Divergência no reenvio: deixa o aviso visível (sem fechar sozinho).
  useAutoClose(phase.kind === "success" && !phase.mismatch, close);

  // Dinheiro em mãos => confirmado. Comprovante de Pix/transferência => alguém confere depois.
  const suggestedConfirm = method === "cash" || !file;
  const confirm = confirmOverride ?? suggestedConfirm;

  const amountCents = toCents(amount);
  const afterCents = remainingCents - pendingCents - amountCents;
  const overLimit = amountCents > availableCents;
  const dateError = !paidOn ? "Informe a data." : paidOn > today ? "A data não pode estar no futuro." : undefined;
  const amountError = overLimit ? `Máximo disponível: ${formatBRL(fromCents(availableCents))}.` : undefined;
  const canSubmit = availableCents > 0 && amountCents > 0 && !overLimit && !dateError && !submitting;

  function pickFile(f: File | null) {
    if (locked) return;
    setConfirmOverride(null);
    if (!f) {
      setFile(null);
      setFileError(null);
      return;
    }
    const err = validateReceiptFile(f);
    setFileError(err);
    setFile(err ? null : f);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setBusy(true);
    try {
      const r = await registerPaymentAction({
        installmentId: i.id,
        amount: fromCents(amountCents),
        paidOn,
        method,
        notes,
        confirm,
        idempotencyKey,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      markCompleted();
      const saved: Saved = {
        paymentId: r.data.paymentId,
        status: r.data.status,
        confirmed: r.data.confirmed,
        amountCents: toCents(r.data.amount),
        mismatch: r.data.mismatch,
      };
      if (saved.mismatch) toast.warning(r.message ?? "Este pagamento já havia sido registrado antes.");
      if (file) {
        const up = await uploadReceipt(saved.paymentId, file);
        if (!up.ok) {
          toast.warning("Pagamento registrado, mas o comprovante não foi enviado.");
          setPhase({ kind: "receipt_failed", error: up.error, ...saved });
          return;
        }
      }
      if (!saved.mismatch) toast.success(r.message ?? "Pagamento registrado.");
      setPhase({ kind: "success", ...saved });
    } catch {
      // Fixa a confirmação atual para que trocar o arquivo não a altere enquanto a chave estiver em uso.
      setConfirmOverride(confirm);
      setLocked(true);
      toast.error("Falha de conexão. Tente novamente — o pagamento não será duplicado.");
    } finally {
      setSubmitting(false);
      setBusy(false);
    }
  }

  async function retryUpload(saved: Saved) {
    if (!file) return;
    setRetrying(true);
    setBusy(true);
    const up = await uploadReceipt(saved.paymentId, file);
    setRetrying(false);
    setBusy(false);
    if (up.ok) {
      toast.success("Comprovante anexado.");
      setPhase({ kind: "success", ...saved });
    } else {
      toast.error(up.error);
      setPhase({ kind: "receipt_failed", error: up.error, ...saved });
    }
  }

  if (phase.kind === "success") {
    const value = formatBRL(fromCents(phase.amountCents));
    if (phase.mismatch) {
      return (
        <SuccessCheck
          title="Pagamento já registrado"
          description={
            <span className="inline-flex items-start gap-1.5 text-left text-warning">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Este pagamento já havia sido registrado antes, com {value} (
                {(PAYMENT_STATUS[phase.status]?.label ?? phase.status).toLowerCase()}). Os novos dados não foram aplicados.
              </span>
            </span>
          }
        >
          <div className="flex justify-center">
            <Button variant="secondary" onClick={close}>
              Fechar
            </Button>
          </div>
        </SuccessCheck>
      );
    }
    // Saldo após o pagamento gravado (pré-visualização; o valor definitivo vem do banco ao recarregar).
    const after = remainingCents - pendingCents - phase.amountCents;
    const quitou = after <= 0 && phase.confirmed && pendingCents === 0;
    return (
      <SuccessCheck
        title={phase.confirmed ? "Recebimento confirmado" : "Recebimento registrado"}
        description={
          phase.confirmed
            ? quitou
              ? `${value} recebidos. Parcela quitada.`
              : `${value} recebidos. Restam ${formatBRL(fromCents(Math.max(0, after + pendingCents)))}.`
            : phase.status === "pending_confirmation"
              ? `${value} aguardando confirmação na aba “A confirmar”.`
              : `${value} · ${PAYMENT_STATUS[phase.status]?.label ?? phase.status}.`
        }
      />
    );
  }

  if (phase.kind === "receipt_failed") {
    return (
      <SuccessCheck
        title="Pagamento registrado"
        description={
          <span className="inline-flex items-start gap-1.5 text-left text-warning">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {phase.error} O pagamento está salvo; você pode tentar de novo agora ou anexar depois em “Comprovantes”.
            </span>
          </span>
        }
      >
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
          <Button variant="ghost" onClick={close} disabled={retrying}>
            Anexar depois
          </Button>
          <Button onClick={() => retryUpload(phase)} loading={retrying}>
            Tentar enviar novamente
          </Button>
        </div>
      </SuccessCheck>
    );
  }

  if (availableCents <= 0) {
    return (
      <div className="flex flex-col items-center py-6 text-center">
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-warning-soft text-warning">
          <Clock3 className="h-5 w-5" />
        </span>
        <p className="text-[15px] font-semibold text-fg">Nada disponível para receber</p>
        <p className="mt-1 max-w-xs text-[13px] text-fg-muted">
          {pendingCents > 0
            ? `Há ${formatBRL(fromCents(pendingCents))} aguardando confirmação nesta parcela. Confirme ou rejeite antes de registrar outro recebimento.`
            : "Esta parcela já está quitada."}
        </p>
        <Button variant="secondary" onClick={close} className="mt-5">
          Fechar
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="grid grid-cols-2 gap-2">
        <SummaryTile label="Saldo da parcela" value={formatBRL(i.remaining)} />
        <SummaryTile label="Disponível para receber" value={formatBRL(fromCents(availableCents))} tone="paper" />
      </div>
      {pendingCents > 0 && (
        <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-warning-soft px-3 py-2 text-[12.5px] text-warning">
          <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {formatBRL(fromCents(pendingCents))} já registrados aguardam confirmação.
        </p>
      )}
      <p className="mt-2 text-[12px] text-fg-subtle">
        Vencimento original {formatDate(i.original_due_date)}
        {i.is_postponed && <> · cobrança em {formatDate(i.collection_date)}</>}
      </p>

      {locked && (
        <p role="status" className="mt-3 flex items-start gap-1.5 rounded-xl bg-warning-soft px-3 py-2 text-[12.5px] text-warning">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          A tentativa anterior pode ter sido gravada. Os dados ficaram travados: toque em enviar de novo para concluir sem
          duplicar. Se precisar de outros valores, feche e registre um novo recebimento.
        </p>
      )}

      <fieldset disabled={locked} className={cn("m-0 mt-4 min-w-0 space-y-4 border-0 p-0", locked && "opacity-70")}>
        <Field label="Valor recebido" required error={amountError}>
          <MoneyInput value={amount} onValueChange={setAmount} data-autofocus className="h-12 text-lg" />
        </Field>
        <div
          className={cn(
            "-mt-2 flex items-center justify-between rounded-xl border px-3 py-2.5 text-[13px]",
            overLimit ? "border-danger/30 bg-danger-soft" : "border-line bg-card",
          )}
          aria-live="polite"
        >
          <span className="text-fg-muted">Saldo restante após este pagamento</span>
          <span className={cn("money font-semibold", overLimit ? "text-danger-fg" : afterCents === 0 ? "text-success" : "text-fg")}>
            {overLimit ? "—" : afterCents === 0 && pendingCents === 0 ? "Quitada" : formatBRL(fromCents(afterCents + pendingCents))}
          </span>
        </div>
        {amountCents > 0 && amountCents < availableCents && (
          <p className="-mt-2 text-[12px] text-fg-subtle">Pagamento parcial — o restante continua em cobrança.</p>
        )}

        <Field label="Data do recebimento" required error={dateError}>
          <Input type="date" value={paidOn} max={today} onChange={(e) => setPaidOn(e.target.value)} className="tabular" />
        </Field>

        <MethodPicker
          label="Forma de pagamento"
          value={method}
          onChange={(m) => {
            if (!m) return;
            setMethod(m);
            setConfirmOverride(null);
          }}
        />

        <ReceiptFileField file={file} onChange={pickFile} error={fileError} />

        <Checkbox
          checked={confirm}
          onChange={setConfirmOverride}
          label="Recebimento confirmado"
          description={
            confirm
              ? "O valor entra no caixa e abate o saldo agora."
              : "Fica “aguardando confirmação” até alguém conferir o valor na conta."
          }
        />

        <Field label="Observação">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} placeholder="Opcional" />
        </Field>
      </fieldset>

      <DialogActions>
        <Button variant="ghost" onClick={close} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" variant={confirm ? "success" : "primary"} loading={submitting} disabled={!canSubmit} size="lg">
          {confirm ? `Receber ${formatBRL(fromCents(amountCents))}` : "Registrar para conferência"}
        </Button>
      </DialogActions>
    </form>
  );
}
