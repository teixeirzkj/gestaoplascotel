"use client";

import { useCallback, useState } from "react";
import { CalendarClock, Handshake, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { num, toCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { InstallmentView } from "@/types/database";
import { PaymentDialog } from "./payment-dialog";
import { PostponeDialog } from "./postpone-dialog";
import { PromiseDialog } from "./promise-dialog";

type Dialog = "pay" | "postpone" | "promise" | null;

/**
 * Ações de cobrança de uma parcela: Receber, Adiar e Promessa.
 * - row: botões lado a lado (desktop/fichas)
 * - stack: botões em coluna, largura total
 * - compact: "Receber" principal + ícones secundários (cards no celular / tabelas)
 * Parcela paga ou cancelada não exibe ações.
 */
export function InstallmentActions({
  installment,
  layout = "row",
  onDone,
}: {
  installment: InstallmentView;
  layout?: "row" | "stack" | "compact";
  onDone?: () => void;
}) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const closeDialog = useCallback(() => setDialog(null), []);

  if (installment.status === "paid" || installment.status === "cancelled") return <></>;

  const available = toCents(num(installment.remaining)) - toCents(num(installment.pending_confirmation_amount));
  const canReceive = available > 0;
  const receiveLabel = canReceive ? "Receber" : "Em conferência";
  const receiveTitle = canReceive ? undefined : "Há pagamento aguardando confirmação que cobre o saldo desta parcela";

  const dialogs = (
    <>
      <PaymentDialog open={dialog === "pay"} onClose={closeDialog} installment={installment} onDone={onDone} />
      <PostponeDialog open={dialog === "postpone"} onClose={closeDialog} installment={installment} onDone={onDone} />
      <PromiseDialog
        open={dialog === "promise"}
        onClose={closeDialog}
        customerId={installment.customer_id}
        customerName={installment.customer_name}
        defaultInstallmentId={installment.id}
        onDone={onDone}
      />
    </>
  );

  if (layout === "compact") {
    return (
      <div className="flex items-center gap-2">
        <Button
          size="md"
          variant={canReceive ? "primary" : "secondary"}
          className="min-w-0 flex-1 px-3 md:flex-none md:px-4"
          onClick={() => setDialog("pay")}
          disabled={!canReceive}
          title={receiveTitle}
        >
          {/* Em telas ≤380px o card divide a linha com os botões de contato: o ícone sai para caber o texto. */}
          <Wallet className="hidden h-4 w-4 shrink-0 min-[380px]:block" aria-hidden />
          <span className="truncate">{receiveLabel}</span>
        </Button>
        <Button size="icon" variant="secondary" onClick={() => setDialog("postpone")} aria-label="Adiar cobrança" title="Adiar cobrança">
          <CalendarClock className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="secondary" onClick={() => setDialog("promise")} aria-label="Registrar promessa" title="Registrar promessa">
          <Handshake className="h-4 w-4" />
        </Button>
        {dialogs}
      </div>
    );
  }

  const stack = layout === "stack";
  return (
    <div className={cn("flex gap-2", stack ? "flex-col" : "flex-wrap items-center")}>
      <Button
        variant={canReceive ? "primary" : "secondary"}
        className={cn(stack && "w-full")}
        size={stack ? "lg" : "md"}
        onClick={() => setDialog("pay")}
        disabled={!canReceive}
        title={receiveTitle}
      >
        <Wallet className="h-4 w-4" /> {receiveLabel}
      </Button>
      <Button variant="secondary" className={cn(stack && "w-full")} size={stack ? "lg" : "md"} onClick={() => setDialog("postpone")}>
        <CalendarClock className="h-4 w-4" /> Adiar
      </Button>
      <Button variant="secondary" className={cn(stack && "w-full")} size={stack ? "lg" : "md"} onClick={() => setDialog("promise")}>
        <Handshake className="h-4 w-4" /> Promessa
      </Button>
      {dialogs}
    </div>
  );
}
