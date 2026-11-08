"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Handshake, Info } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, MoneyInput, Select, Textarea } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/states";
import { formatBRL, formatDate, formatDateLong } from "@/lib/format";
import { addDays, todayISO } from "@/lib/dates";
import { fromCents, num, toCents } from "@/lib/money";
import type { PaymentMethod } from "@/lib/labels";
import { createClient } from "@/lib/supabase/client";
import type { InstallmentView } from "@/types/database";
import { createPromiseAction } from "../actions";
import { installmentLabel } from "../messages";
import { DialogActions, MethodPicker, SuccessCheck, useAutoClose, useDialogLifecycle } from "./form-parts";

type Props = {
  open: boolean;
  onClose: () => void;
  customerId: string;
  customerName: string;
  installments?: InstallmentView[];
  defaultInstallmentId?: string | null;
  onDone?: () => void;
};

/** Registrar promessa de pagamento. Promessa NÃO é pagamento: não altera saldo nem caixa. */
export function PromiseDialog({ open, onClose, customerId, customerName, installments, defaultInstallmentId, onDone }: Props) {
  const { close, setBusy, markCompleted } = useDialogLifecycle(onClose, onDone);
  return (
    <Modal open={open} onClose={close} title="Registrar promessa" description={customerName}>
      <PromiseLoader
        customerId={customerId}
        installments={installments}
        defaultInstallmentId={defaultInstallmentId ?? null}
        close={close}
        setBusy={setBusy}
        markCompleted={markCompleted}
      />
    </Modal>
  );
}

type FormCtx = { close: () => void; setBusy: (b: boolean) => void; markCompleted: () => void };

/** Usa as parcelas recebidas ou busca as parcelas em aberto do cliente. */
function PromiseLoader({
  customerId,
  installments,
  defaultInstallmentId,
  ...ctx
}: FormCtx & { customerId: string; installments?: InstallmentView[]; defaultInstallmentId: string | null }) {
  const [fetched, setFetched] = useState<InstallmentView[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (installments) return;
    let alive = true;
    createClient()
      .from("v_installments")
      .select("*")
      .eq("customer_id", customerId)
      .not("status", "in", "(paid,cancelled)")
      .order("collection_date", { ascending: true })
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) setLoadError(true);
        else setFetched((data ?? []) as InstallmentView[]);
      });
    return () => {
      alive = false;
    };
  }, [customerId, installments]);

  const list = (installments ?? fetched)?.filter((x) => x.status !== "paid" && x.status !== "cancelled");

  if (loadError && !installments) {
    return (
      <div className="py-8 text-center">
        <p className="text-[15px] font-semibold text-fg">Não foi possível carregar as parcelas</p>
        <p className="mt-1 text-[13px] text-fg-muted">Verifique sua conexão e abra novamente.</p>
        <Button variant="secondary" className="mt-4" onClick={ctx.close}>
          Fechar
        </Button>
      </div>
    );
  }
  if (!list) {
    return (
      <div className="space-y-3" role="status" aria-label="Carregando parcelas">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-11" />
        <Skeleton className="h-11" />
        <Skeleton className="h-12" />
      </div>
    );
  }
  if (list.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-[15px] font-semibold text-fg">Nenhuma parcela em aberto</p>
        <p className="mt-1 text-[13px] text-fg-muted">Este cliente não tem saldo para registrar promessa.</p>
        <Button variant="secondary" className="mt-4" onClick={ctx.close}>
          Fechar
        </Button>
      </div>
    );
  }
  const initial = defaultInstallmentId && list.some((x) => x.id === defaultInstallmentId) ? defaultInstallmentId : "";
  return <PromiseForm customerId={customerId} installments={list} initialInstallmentId={initial} {...ctx} />;
}

function PromiseForm({
  customerId,
  installments,
  initialInstallmentId,
  close,
  setBusy,
  markCompleted,
}: FormCtx & { customerId: string; installments: InstallmentView[]; initialInstallmentId: string }) {
  const today = todayISO();
  const [installmentId, setInstallmentId] = useState(initialInstallmentId);
  const [amountOverride, setAmountOverride] = useState<number | null>(null);
  const [dueDate, setDueDate] = useState(addDays(today, 7));
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ amount: number; date: string } | null>(null);

  useAutoClose(done !== null, close);

  const totalCents = installments.reduce((acc, x) => acc + toCents(num(x.remaining)), 0);
  const selected = installments.find((x) => x.id === installmentId) ?? null;
  const defaultCents = selected ? toCents(num(selected.remaining)) : totalCents;
  const amount = amountOverride ?? fromCents(defaultCents);
  const amountCents = toCents(amount);
  const limitCents = totalCents;

  const amountError = amountCents > limitCents ? `Máximo: ${formatBRL(fromCents(limitCents))} (saldo devedor).` : undefined;
  const dateError = !dueDate ? "Informe a data combinada." : dueDate < today ? "A data deve ser hoje ou futura." : undefined;
  const canSubmit = amountCents > 0 && !amountError && !dateError && !submitting;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setBusy(true);
    try {
      const r = await createPromiseAction({
        customerId,
        installmentId: installmentId || null,
        amount: fromCents(amountCents),
        dueDate,
        expectedMethod: method,
        notes,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      markCompleted();
      toast.success(r.message ?? "Promessa registrada.");
      setDone({ amount: fromCents(amountCents), date: dueDate });
    } catch {
      toast.error("Falha de conexão. Tente novamente.");
    } finally {
      setSubmitting(false);
      setBusy(false);
    }
  }

  if (done) {
    return (
      <SuccessCheck
        title="Promessa registrada"
        description={`${formatBRL(done.amount)} para ${formatDateLong(done.date)}. Se não for paga até a data, aparecerá como não cumprida.`}
      />
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="flex items-start gap-3 rounded-xl bg-paper px-3.5 py-3 text-paper-ink">
        <Handshake className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">Promessa não é pagamento</p>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-paper-muted">
            É um compromisso do cliente. O saldo só muda quando o recebimento for registrado.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <Field label="Parcela" hint={`Saldo devedor total: ${formatBRL(fromCents(totalCents))}`}>
          <Select
            value={installmentId}
            onChange={(e) => {
              setInstallmentId(e.target.value);
              setAmountOverride(null);
            }}
          >
            <option value="">Saldo geral (sem parcela específica)</option>
            {installments.map((x) => (
              <option key={x.id} value={x.id}>
                #{x.sale_code} · {installmentLabel(x.number)} · {formatBRL(x.remaining)} · {formatDate(x.collection_date)}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-1 gap-4 xs:grid-cols-2">
          <Field label="Valor prometido" required error={amountError}>
            <MoneyInput value={amount} onValueChange={setAmountOverride} />
          </Field>
          <Field label="Data combinada" required error={dateError}>
            <Input type="date" value={dueDate} min={today} onChange={(e) => setDueDate(e.target.value)} className="tabular" />
          </Field>
        </div>

        <MethodPicker label="Forma esperada" value={method} onChange={setMethod} allowNone />

        <Field label="Observação">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} placeholder="Ex.: vai pagar quando receber o salário" />
        </Field>

        <p className="flex items-start gap-1.5 text-[12px] text-fg-subtle">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Quando os pagamentos confirmados cobrirem o valor, a promessa é marcada como cumprida automaticamente.
        </p>
      </div>

      <DialogActions>
        <Button variant="ghost" onClick={close} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" loading={submitting} disabled={!canSubmit} size="lg">
          Registrar promessa
        </Button>
      </DialogActions>
    </form>
  );
}
