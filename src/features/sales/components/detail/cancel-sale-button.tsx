"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/misc";
import { useShellUser } from "@/components/layout/app-shell";
import { cancelSale } from "../../actions";

export function CancelSaleButton({ saleId, code, activePayments }: { saleId: string; code: number; activePayments: number }) {
  const { isOwner } = useShellUser();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!isOwner) return null;

  function confirm(reason: string) {
    return new Promise<void>((resolve) => {
      startTransition(async () => {
        const r = await cancelSale({ sale_id: saleId, reason });
        if (!r.ok) {
          toast.error(r.error);
        } else {
          toast.success(r.message ?? "Venda cancelada.");
          setOpen(false);
          router.refresh();
        }
        resolve();
      });
    });
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="w-full text-danger-fg hover:bg-danger-soft sm:w-auto">
        <Ban className="h-4 w-4" /> Cancelar venda
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={confirm}
        loading={pending}
        tone="danger"
        title={`Cancelar venda #${code}?`}
        description={
          activePayments > 0 ? (
            <span className="text-warning">
              Esta venda tem {activePayments} {activePayments === 1 ? "pagamento ativo" : "pagamentos ativos"}. Estorne ou rejeite antes de
              cancelar — caso contrário o sistema bloqueará o cancelamento.
            </span>
          ) : (
            "As parcelas em aberto serão canceladas e deixarão de aparecer nas cobranças. Esta ação não pode ser desfeita."
          )
        }
        confirmLabel="Cancelar venda"
        requireReason
        reasonLabel="Motivo do cancelamento"
      />
    </>
  );
}
