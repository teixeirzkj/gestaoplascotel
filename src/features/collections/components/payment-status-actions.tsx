"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Paperclip, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/misc";
import { Modal } from "@/components/ui/modal";
import { useShellUser } from "@/components/layout/app-shell";
import { formatBRL, formatDate } from "@/lib/format";
import { methodLabel } from "@/lib/labels";
import type { PaymentView } from "@/types/database";
import { confirmPaymentAction, rejectPaymentAction, reversePaymentAction } from "../actions";
import { installmentLabel } from "../messages";
import { ReceiptList } from "./receipt-list";

type Pending = "confirm" | "reject" | "reverse" | null;

/**
 * Ações sobre um pagamento: confirmar / não confirmar (pendentes), estornar (proprietário, confirmados)
 * e comprovantes (ver/anexar).
 */
export function PaymentStatusActions({ payment, onDone }: { payment: PaymentView; onDone?: () => void }) {
  const router = useRouter();
  const user = useShellUser();
  const [dialog, setDialog] = useState<Pending>(null);
  const [loading, setLoading] = useState<Pending>(null);
  const [receiptsOpen, setReceiptsOpen] = useState(false);
  const closeDialog = useCallback(() => setDialog(null), []);
  const closeReceipts = useCallback(() => setReceiptsOpen(false), []);

  const isPending = payment.status === "pending_confirmation";
  const canReject = isPending && (user.isOwner || payment.created_by === user.id);
  const canReverse = payment.status === "confirmed" && user.isOwner;
  const summary = `${formatBRL(payment.amount)} via ${methodLabel(payment.method)} em ${formatDate(payment.paid_on)} — ${payment.customer_name}, venda #${payment.sale_code} (${installmentLabel(payment.installment_number)})`;

  function finish() {
    onDone?.();
    router.refresh();
  }

  async function run(kind: Exclude<Pending, null>, reason = "") {
    setLoading(kind);
    try {
      const r =
        kind === "confirm"
          ? await confirmPaymentAction(payment.id)
          : kind === "reject"
            ? await rejectPaymentAction({ paymentId: payment.id, reason })
            : await reversePaymentAction({ paymentId: payment.id, reason });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(r.message ?? "Feito.");
      setDialog(null);
      finish();
    } catch {
      toast.error("Falha de conexão. Tente novamente.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isPending && (
        <Button variant="success" onClick={() => setDialog("confirm")} disabled={loading !== null} className="flex-1 sm:flex-none">
          <Check className="h-4 w-4" /> Confirmar
        </Button>
      )}
      {canReject && (
        <Button variant="secondary" onClick={() => setDialog("reject")} disabled={loading !== null} className="flex-1 sm:flex-none">
          <X className="h-4 w-4" /> Não confirmar
        </Button>
      )}
      {canReverse && (
        <Button variant="outline" onClick={() => setDialog("reverse")} disabled={loading !== null} className="text-danger-fg">
          <Undo2 className="h-4 w-4" /> Estornar
        </Button>
      )}
      <Button
        variant="ghost"
        size="md"
        onClick={() => setReceiptsOpen(true)}
        aria-label={`Comprovantes (${payment.receipts_count})`}
        className="px-3"
      >
        <Paperclip className="h-4 w-4" />
        <span className="tabular">{payment.receipts_count}</span>
        <span className="hidden sm:inline">{payment.receipts_count === 1 ? "comprovante" : "comprovantes"}</span>
      </Button>

      <ConfirmDialog
        open={dialog === "confirm"}
        onClose={closeDialog}
        onConfirm={() => run("confirm")}
        loading={loading === "confirm"}
        title="Confirmar recebimento?"
        description={
          <>
            {summary}. O valor entra no caixa e abate o saldo da parcela.
            {payment.receipts_count === 0 && " Não há comprovante anexado."}
          </>
        }
        confirmLabel="Confirmar recebimento"
      />
      <ConfirmDialog
        open={dialog === "reject"}
        onClose={closeDialog}
        onConfirm={(reason) => run("reject", reason)}
        loading={loading === "reject"}
        title="Não confirmar pagamento"
        description={`${summary}. O valor não entra no caixa e a parcela continua em aberto.`}
        confirmLabel="Não confirmar"
        tone="danger"
        requireReason
        minReason={3}
        reasonLabel="Motivo"
      />
      <ConfirmDialog
        open={dialog === "reverse"}
        onClose={closeDialog}
        onConfirm={(reason) => run("reverse", reason)}
        loading={loading === "reverse"}
        title="Estornar pagamento"
        description={`${summary}. O saldo volta para a parcela e um estorno é lançado no caixa de hoje.`}
        confirmLabel="Estornar"
        tone="danger"
        requireReason
        minReason={5}
        reasonLabel="Justificativa do estorno"
      />
      <Modal open={receiptsOpen} onClose={closeReceipts} title="Comprovantes" description={summary} size="sm">
        <ReceiptList paymentId={payment.id} />
      </Modal>
    </div>
  );
}
