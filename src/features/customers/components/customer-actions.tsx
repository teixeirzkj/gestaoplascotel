"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, HandCoins, NotebookPen, Pencil, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { Button, ButtonLink } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/misc";
import { useShellUser } from "@/components/layout/app-shell";
import { PromiseDialog } from "@/features/collections/components/promise-dialog";
import { formatBRL } from "@/lib/format";
import type { InstallmentView } from "@/types/database";
import { setCustomerArchivedAction } from "../actions";
import { NoteDialog } from "./note-form";

/** Ações rápidas da ficha: venda (proprietário), promessa, observação, editar/arquivar (proprietário). */
export function CustomerQuickActions({
  customerId,
  customerName,
  archived,
  openInstallments,
}: {
  customerId: string;
  customerName: string;
  archived: boolean;
  openInstallments: InstallmentView[];
}) {
  const { isOwner } = useShellUser();
  const [promiseOpen, setPromiseOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);

  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
        {isOwner && !archived && (
          <ButtonLink href={`/vendas/nova?cliente=${customerId}`} className="col-span-3 sm:col-span-1">
            <ShoppingBag className="h-4 w-4" /> Registrar venda
          </ButtonLink>
        )}
        <Button
          variant="secondary"
          onClick={() => setPromiseOpen(true)}
          disabled={openInstallments.length === 0}
          title={openInstallments.length === 0 ? "Sem parcelas em aberto" : undefined}
        >
          <HandCoins className="h-4 w-4" /> Promessa
        </Button>
        <Button variant="secondary" onClick={() => setNoteOpen(true)} className={isOwner ? "col-span-1" : "col-span-2"}>
          <NotebookPen className="h-4 w-4" /> Observação
        </Button>
        {isOwner && (
          <ButtonLink href={`/clientes/${customerId}/editar`} variant="secondary" className="col-span-1">
            <Pencil className="h-4 w-4" /> Editar
          </ButtonLink>
        )}
      </div>
      <PromiseDialog
        open={promiseOpen}
        onClose={() => setPromiseOpen(false)}
        customerId={customerId}
        customerName={customerName}
        installments={openInstallments}
        defaultInstallmentId={openInstallments[0]?.id ?? null}
      />
      <NoteDialog open={noteOpen} onClose={() => setNoteOpen(false)} customerId={customerId} customerName={customerName} />
    </>
  );
}

/** Arquivar/reativar (proprietário). Cliente nunca é excluído. */
export function ArchiveCustomerButton({
  customerId,
  customerName,
  archived,
  balance = 0,
}: {
  customerId: string;
  customerName: string;
  archived: boolean;
  /** Saldo devedor atual; quando > 0, o diálogo avisa o que muda ao arquivar. */
  balance?: number;
}) {
  const { isOwner } = useShellUser();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  if (!isOwner) return null;
  const hasDebt = !archived && balance > 0;

  async function confirm() {
    setLoading(true);
    const r = await setCustomerArchivedAction({ id: customerId, archived: !archived });
    setLoading(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success(r.message ?? "Feito");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} className="h-11 sm:h-9">
        {archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
        {archived ? "Reativar cliente" : "Arquivar cliente"}
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={confirm}
        loading={loading}
        tone={archived ? "primary" : "danger"}
        title={archived ? "Reativar cliente?" : "Arquivar cliente?"}
        confirmLabel={archived ? "Reativar" : hasDebt ? "Arquivar mesmo assim" : "Arquivar"}
        description={
          archived
            ? `${customerName} voltará a aparecer nas listas e buscas.`
            : hasDebt
              ? `${customerName} tem ${formatBRL(balance)} em aberto. Ao arquivar, as parcelas continuam somando nos totais do painel e em Cobranças, mas o cliente deixa de aparecer em "Atenção hoje", "Próximas cobranças" e nas sugestões de visita da agenda.`
              : `${customerName} deixa de aparecer nas listas padrão. Vendas, parcelas e histórico são mantidos — nada é excluído.`
        }
      />
    </>
  );
}
