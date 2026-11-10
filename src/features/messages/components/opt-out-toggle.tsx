"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { setMessagesOptOutAction } from "../actions";

export function OptOutToggle({ customerId, optOut, detail }: { customerId: string; optOut: boolean; detail: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  async function apply(next: boolean, why: string | null) {
    setLoading(true);
    const r = await setMessagesOptOutAction({ customerId, optOut: next, reason: why });
    setLoading(false);
    if (!r.ok) return toast.error(r.error);
    toast.success(r.message);
    setOpen(false);
    setReason("");
    router.refresh();
  }

  return (
    <div className={cn("flex items-center gap-3 rounded-2xl border px-4 py-3", optOut ? "border-warning/30 bg-warning-soft" : "border-line bg-card")}>
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", optOut ? "bg-warning-soft text-warning" : "bg-success-soft text-success")}>
        {optOut ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-fg">{optOut ? "Não recebe mensagens de cobrança" : "Recebe mensagens de cobrança"}</p>
        {detail && <p className="truncate text-[12px] text-fg-muted">{detail}</p>}
      </div>
      {optOut ? (
        <Button size="sm" variant="secondary" loading={loading} onClick={() => apply(false, null)}>Reativar</Button>
      ) : (
        <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>Desativar</Button>
      )}
      <Modal
        open={open}
        onClose={() => !loading && setOpen(false)}
        title="Não enviar mensagens de cobrança"
        description="O cliente deixa de aparecer na fila de mensagens. Fica registrado no histórico."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={loading}>Voltar</Button>
            <Button variant="danger" loading={loading} disabled={reason.trim().length < 3} onClick={() => apply(true, reason.trim())}>Confirmar</Button>
          </>
        }
      >
        <Field label="Motivo" required>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Ex.: cliente pediu para não receber" />
        </Field>
      </Modal>
    </div>
  );
}
