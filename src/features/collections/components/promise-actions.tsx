"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { formatBRL, formatDate } from "@/lib/format";
import type { PromiseView } from "@/types/database";
import { resolvePromiseAction } from "../actions";

type Resolution = "kept" | "broken" | "cancelled";

const COPY: Record<Resolution, { title: string; confirm: string; hint: string; variant: "success" | "danger" | "secondary" }> = {
  kept: {
    title: "Marcar promessa como cumprida",
    confirm: "Marcar cumprida",
    hint: "Use quando o cliente cumpriu o combinado. Lembre-se: o recebimento deve ser registrado na parcela.",
    variant: "success",
  },
  broken: {
    title: "Marcar promessa como não cumprida",
    confirm: "Não cumprida",
    hint: "Fica registrado no histórico do cliente.",
    variant: "danger",
  },
  cancelled: {
    title: "Cancelar promessa",
    confirm: "Cancelar promessa",
    hint: "Use quando a promessa foi registrada por engano ou substituída por outro acordo.",
    variant: "secondary",
  },
};

/** Resolver promessa pendente: cumprida, não cumprida ou cancelada. */
export function PromiseActions({ promise, onDone }: { promise: PromiseView; onDone?: () => void }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<Resolution | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const close = useCallback(() => {
    if (loading) return;
    setDialog(null);
    setNotes("");
  }, [loading]);

  if (promise.status !== "pending") return <></>;

  async function resolve(status: Resolution) {
    setLoading(true);
    try {
      const r = await resolvePromiseAction({ promiseId: promise.id, status, notes });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(r.message ?? "Promessa atualizada.");
      setDialog(null);
      setNotes("");
      onDone?.();
      router.refresh();
    } catch {
      toast.error("Falha de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const copy = dialog ? COPY[dialog] : null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" size="sm" onClick={() => setDialog("kept")} className="h-11 sm:h-9">
        <CheckCircle2 className="h-4 w-4 text-success" /> Cumprida
      </Button>
      <Button variant="secondary" size="sm" onClick={() => setDialog("broken")} className="h-11 sm:h-9">
        <XCircle className="h-4 w-4 text-danger-fg" /> Não cumprida
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setDialog("cancelled")} className="h-11 sm:h-9">
        <Ban className="h-4 w-4" /> Cancelar
      </Button>

      <Modal
        open={dialog !== null}
        onClose={close}
        size="sm"
        title={copy?.title ?? ""}
        description={`${formatBRL(promise.amount)} combinados para ${formatDate(promise.due_date)} — ${promise.customer_name}`}
        footer={
          <>
            <Button variant="ghost" onClick={close} disabled={loading}>
              Voltar
            </Button>
            {dialog && copy && (
              <Button variant={copy.variant} loading={loading} onClick={() => resolve(dialog)}>
                {copy.confirm}
              </Button>
            )}
          </>
        }
      >
        <p className="mb-4 text-[13px] leading-relaxed text-fg-muted">{copy?.hint}</p>
        <Field label="Observação">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={300} placeholder="Opcional" />
        </Field>
      </Modal>
    </div>
  );
}
