"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Banknote,
  CalendarClock,
  Circle,
  Home,
  MessageSquareText,
  Navigation,
  Route as RouteIcon,
  Trash2,
  UserCheck,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { ConfirmDialog, ContactButtons, Money } from "@/components/ui/misc";
import { Modal } from "@/components/ui/modal";
import { INSTALLMENT_STATUS, VISIT_CUSTOMER_STATUS } from "@/lib/labels";
import { formatBRL } from "@/lib/format";
import { ease } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { VisitCustomerStatus } from "@/types/database";
import { InstallmentActions } from "@/features/collections/components/installment-actions";
import { PaymentDialog } from "@/features/collections/components/payment-dialog";
import { PostponeDialog } from "@/features/collections/components/postpone-dialog";
import { ReasonChips } from "@/features/cities/components/city-sections";
import { removeVisitCustomerAction, setVisitCustomerStatusAction } from "../actions";
import { mapsSearchLink } from "../utils";
import type { VisitCustomerDetail } from "../types";
import { TypedDate } from "./date-semantics";

const STATUS_BUTTONS: { value: VisitCustomerStatus; label: string; icon: LucideIcon; active: string }[] = [
  { value: "to_visit", label: "A visitar", icon: Circle, active: "border-line-strong bg-white/[0.08] text-fg" },
  { value: "visited", label: "Visitado", icon: UserCheck, active: "border-info/40 bg-info-soft text-info" },
  { value: "not_found", label: "Não encontrado", icon: UserX, active: "border-warning/40 bg-warning-soft text-warning" },
  { value: "payment_received", label: "Pagamento recebido", icon: Banknote, active: "border-success/40 bg-success-soft text-success" },
  { value: "rescheduled", label: "Nova data combinada", icon: CalendarClock, active: "border-bronze/50 bg-bronze-soft text-bronze" },
];

export function VisitCustomerCard({
  customer,
  position,
  cityName,
  cityState,
  visitStatus,
}: {
  customer: VisitCustomerDetail;
  position: number;
  cityName: string;
  cityState: string;
  visitStatus: "planned" | "done" | "cancelled";
}) {
  const router = useRouter();
  const [status, setOptimisticStatus] = useOptimistic(customer.status);
  const [pending, startTransition] = useTransition();
  const [followUp, setFollowUp] = useState<null | "payment" | "postpone">(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [postponeOpen, setPostponeOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState(customer.notes ?? "");
  const [removeOpen, setRemoveOpen] = useState(false);
  const installment = customer.oldestOpen;
  const locked = visitStatus === "cancelled";

  function changeStatus(next: VisitCustomerStatus) {
    if (next === status || locked) return;
    setFollowUp(null);
    startTransition(async () => {
      setOptimisticStatus(next);
      const r = await setVisitCustomerStatusAction({ id: customer.id, status: next, notes: "" });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(`${customer.fullName}: ${VISIT_CUSTOMER_STATUS[next].label.toLowerCase()}.`);
      router.refresh();
      if (installment && next === "payment_received") setFollowUp("payment");
      if (installment && next === "rescheduled") setFollowUp("postpone");
    });
  }

  function saveNote() {
    startTransition(async () => {
      const r = await setVisitCustomerStatusAction({ id: customer.id, status, notes: note });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Observação registrada.");
      setNoteOpen(false);
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const r = await removeVisitCustomerAction({ id: customer.id });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(r.message ?? "Cliente removido.");
      setRemoveOpen(false);
      router.refresh();
    });
  }

  const maps = mapsSearchLink({
    lat: customer.latitude,
    lng: customer.longitude,
    address: customer.address,
    neighborhood: customer.neighborhood,
    city: cityName,
    state: cityState,
  });
  const done = status !== "to_visit";

  return (
    <article
      id={`c-${customer.id}`}
      className={cn(
        "scroll-mt-24 rounded-2xl border bg-card shadow-card transition-colors",
        done ? "border-line" : "border-line-strong",
      )}
    >
      <div className="p-4 sm:p-5">
        {/* Cabeçalho */}
        <div className="flex flex-wrap items-start gap-3">
          <span
            className={cn(
              "tabular flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[14px] font-semibold",
              done ? "bg-success-soft text-success" : "bg-paper text-paper-ink",
            )}
            aria-label={`Parada ${position}`}
          >
            {position}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Link href={`/clientes/${customer.customerId}`} className="text-[16px] font-semibold tracking-tight text-fg hover:text-bronze">
                {customer.fullName}
              </Link>
              <StatusBadge status={status} map={VISIT_CUSTOMER_STATUS} />
            </div>
            {(customer.address || customer.neighborhood) && (
              <p className="mt-1 flex items-start gap-1.5 text-[13px] text-fg">
                <Home className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fg-subtle" aria-hidden />
                <span>{[customer.address, customer.neighborhood].filter(Boolean).join(" · ")}</span>
              </p>
            )}
            {customer.reference && (
              <p className="mt-0.5 flex items-start gap-1.5 text-[12.5px] text-fg-muted">
                <Navigation className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fg-subtle" aria-hidden />
                <span>{customer.reference}</span>
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2 max-sm:w-full max-sm:pl-12">
            {maps && (
              <a
                href={maps}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Abrir endereço no mapa"
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-line text-fg-muted transition-colors hover:bg-white/5 hover:text-fg"
              >
                <RouteIcon className="h-4 w-4" />
              </a>
            )}
            <ContactButtons phone={customer.phone} whatsapp={customer.whatsapp} size="icon" />
          </div>
        </div>

        {/* Financeiro */}
        <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-bg-elevated px-3.5 py-2.5">
          <div>
            <p className="text-[11.5px] text-fg-subtle">Saldo</p>
            <Money value={customer.balance} className="text-[15px] font-semibold text-fg" />
          </div>
          <div>
            <p className="text-[11.5px] text-fg-subtle">Em atraso</p>
            <Money value={customer.overdueAmount} className={cn("text-[15px] font-semibold", customer.overdueAmount > 0 ? "text-danger" : "text-fg-muted")} />
          </div>
        </div>
        {customer.reason && <ReasonChips reason={customer.reason} className="mt-2.5" />}

        {installment ? (
          <div className="mt-3 rounded-xl border border-line px-3.5 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[12.5px] text-fg-muted">
                Parcela em aberto mais antiga · <span className="text-fg">Venda #{installment.sale_code}</span> ·{" "}
                {installment.number === 0 ? "entrada" : `parcela ${installment.number}`}
                {customer.openCount > 1 && <span className="text-fg-subtle"> (+{customer.openCount - 1})</span>}
              </p>
              <StatusBadge status={installment.status} map={INSTALLMENT_STATUS} className="h-5 px-2 text-[11px]" />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
              <TypedDate kind="due" date={installment.original_due_date} />
              <TypedDate kind="collection" date={installment.collection_date} />
              <span className="text-[12px] text-fg-subtle">
                Restante <span className="money font-semibold text-fg">{formatBRL(installment.remaining)}</span>
              </span>
            </div>
            <div className="mt-2.5">
              <InstallmentActions installment={installment} layout="compact" onDone={() => setFollowUp(null)} />
            </div>
          </div>
        ) : (
          customer.balance <= 0 && <p className="mt-2.5 text-[12.5px] text-fg-subtle">Sem parcelas em aberto.</p>
        )}

        {customer.notes && (
          <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-white/[0.03] px-3 py-2 text-[12.5px] text-fg-muted">
            <MessageSquareText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fg-subtle" aria-hidden />
            <span className="whitespace-pre-line">{customer.notes}</span>
          </p>
        )}
      </div>

      {/* Resultado do atendimento */}
      <div className="border-t border-line px-4 py-3.5 sm:px-5">
        <p className="mb-2 text-[12px] font-medium text-fg-muted">Resultado do atendimento</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" role="radiogroup" aria-label={`Resultado do atendimento de ${customer.fullName}`}>
          {STATUS_BUTTONS.map((b, i) => {
            const active = status === b.value;
            const Icon = b.icon;
            return (
              <button
                key={b.value}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={locked || pending}
                onClick={() => changeStatus(b.value)}
                className={cn(
                  "flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border px-2.5 py-2 text-center text-[13px] font-medium leading-tight transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50",
                  active ? b.active : "border-line text-fg-muted hover:border-line-strong hover:text-fg",
                  i === STATUS_BUTTONS.length - 1 && "col-span-2 sm:col-span-1",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span>{b.label}</span>
              </button>
            );
          })}
        </div>
        {locked && <p className="mt-2 text-[12px] text-fg-subtle">Visita cancelada — reabra a visita para registrar atendimentos.</p>}

        <AnimatePresence initial={false}>
          {followUp && installment && (
            <motion.div
              key={followUp}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.22, ease: ease.out } }}
              exit={{ opacity: 0, y: -4, transition: { duration: 0.14 } }}
              className="mt-3 flex flex-col gap-2.5 rounded-xl bg-paper px-3.5 py-3 text-paper-ink sm:flex-row sm:items-center sm:justify-between"
            >
              <p className="text-[13px] font-medium">
                {followUp === "payment"
                  ? `Registrar o pagamento da parcela agora? Restante ${formatBRL(installment.remaining)}.`
                  : "Atualizar a data de cobrança da parcela com a nova data combinada?"}
              </p>
              <div className="flex shrink-0 gap-2">
                <Button variant="ghost" size="sm" className="text-paper-muted hover:bg-black/5 hover:text-paper-ink" onClick={() => setFollowUp(null)}>
                  Agora não
                </Button>
                <Button size="sm" onClick={() => (followUp === "payment" ? setPaymentOpen(true) : setPostponeOpen(true))}>
                  {followUp === "payment" ? (
                    <>
                      <Banknote className="h-4 w-4" /> Receber
                    </>
                  ) : (
                    <>
                      <CalendarClock className="h-4 w-4" /> Adiar parcela
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => setNoteOpen(true)} disabled={locked}>
            <MessageSquareText className="h-4 w-4" /> {customer.notes ? "Editar observação" : "Observação"}
          </Button>
          {status === "to_visit" && visitStatus === "planned" && (
            <Button variant="ghost" size="sm" onClick={() => setRemoveOpen(true)} className="text-fg-subtle hover:text-danger">
              <Trash2 className="h-4 w-4" /> Remover da visita
            </Button>
          )}
        </div>
      </div>

      {installment && (
        <>
          <PaymentDialog
            open={paymentOpen}
            onClose={() => setPaymentOpen(false)}
            installment={installment}
            onDone={() => {
              setPaymentOpen(false);
              setFollowUp(null);
            }}
          />
          <PostponeDialog
            open={postponeOpen}
            onClose={() => setPostponeOpen(false)}
            installment={installment}
            onDone={() => {
              setPostponeOpen(false);
              setFollowUp(null);
            }}
          />
        </>
      )}

      <Modal
        open={noteOpen}
        onClose={() => !pending && setNoteOpen(false)}
        title="Observação do atendimento"
        description={customer.fullName}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setNoteOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={saveNote} loading={pending} disabled={!note.trim()}>
              Salvar observação
            </Button>
          </>
        }
      >
        <Field label="Observação" hint="Salva neste atendimento e aparece no histórico do cliente quando o resultado é registrado.">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="Ex.: pediu para voltar no sábado pela manhã" />
        </Field>
      </Modal>

      <ConfirmDialog
        open={removeOpen}
        onClose={() => setRemoveOpen(false)}
        onConfirm={remove}
        loading={pending}
        title={`Remover ${customer.fullName} da visita?`}
        description="O cliente pode ser adicionado novamente depois. Nenhum dado financeiro é alterado."
        confirmLabel="Remover"
        tone="danger"
      />
    </article>
  );
}
