"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Pencil, RotateCcw, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/misc";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Textarea } from "@/components/ui/field";
import { useShellUser } from "@/components/layout/app-shell";
import type { VisitStatus } from "@/types/database";
import { deleteVisitAction, setVisitStatusAction, updateVisitAction } from "../actions";
import { formatVisitTime } from "../utils";

type VisitBasics = { id: string; cityName: string; visitDate: string; visitTime: string | null; notes: string | null; status: VisitStatus };

function EditVisitDialog({ open, onClose, visit }: { open: boolean; onClose: () => void; visit: VisitBasics }) {
  const router = useRouter();
  const [date, setDate] = useState(visit.visitDate);
  const [time, setTime] = useState(formatVisitTime(visit.visitTime) ?? "");
  const [notes, setNotes] = useState(visit.notes ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r = await updateVisitAction({ id: visit.id, date, time, notes });
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        toast.error(r.error);
        return;
      }
      toast.success(r.message ?? "Visita atualizada.");
      onClose();
      router.refresh();
    });
  }

  return (
    <Modal
      open={open}
      onClose={() => !pending && onClose()}
      title="Editar visita"
      description={`Visita a ${visit.cityName}. Alterar a data da visita não muda vencimentos nem datas de cobrança.`}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" form="edit-visit-form" loading={pending}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="edit-visit-form" onSubmit={submit} className="grid gap-4" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data da visita" required error={errors.date}>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="tabular" />
          </Field>
          <Field label="Horário" error={errors.time} hint="Opcional">
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="tabular" />
          </Field>
        </div>
        <Field label="Observações" error={errors.notes}>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
        </Field>
      </form>
    </Modal>
  );
}

/** Ações da visita: realizar / cancelar / reabrir, editar e excluir (proprietário, sem atendimentos). */
export function VisitActions({ visit, attendedCount }: { visit: VisitBasics; attendedCount: number }) {
  const user = useShellUser();
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [editKey, setEditKey] = useState(0);
  const [confirm, setConfirm] = useState<null | "cancel" | "delete" | "done">(null);
  const [pending, startTransition] = useTransition();

  function changeStatus(status: VisitStatus) {
    startTransition(async () => {
      const r = await setVisitStatusAction({ id: visit.id, status });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(r.message ?? "Visita atualizada.");
      setConfirm(null);
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const r = await deleteVisitAction({ id: visit.id });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(r.message ?? "Visita excluída.");
      setConfirm(null);
      router.push("/agenda");
    });
  }

  const canDelete = user.isOwner && attendedCount === 0;

  return (
    <>
      {visit.status === "planned" ? (
        <>
          <Button variant="success" onClick={() => setConfirm("done")} disabled={pending} className="flex-1 sm:flex-none">
            <CheckCircle2 className="h-4 w-4" /> Marcar como realizada
          </Button>
          <Button variant="secondary" onClick={() => setConfirm("cancel")} disabled={pending} className="flex-1 sm:flex-none">
            <XCircle className="h-4 w-4" /> Cancelar
          </Button>
        </>
      ) : (
        <Button variant="secondary" onClick={() => changeStatus("planned")} loading={pending} className="flex-1 sm:flex-none">
          <RotateCcw className="h-4 w-4" /> Reabrir visita
        </Button>
      )}
      <Button
        variant="ghost"
        onClick={() => {
          setEditKey((k) => k + 1);
          setEditOpen(true);
        }}
        disabled={pending}
        className="flex-1 sm:flex-none"
      >
        <Pencil className="h-4 w-4" /> Editar
      </Button>
      {canDelete && (
        <Button
          variant="ghost"
          aria-label="Excluir visita"
          onClick={() => setConfirm("delete")}
          disabled={pending}
          className="text-danger hover:bg-danger-soft hover:text-danger"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Excluir</span>
        </Button>
      )}

      <EditVisitDialog key={editKey} open={editOpen} onClose={() => setEditOpen(false)} visit={visit} />
      <ConfirmDialog
        open={confirm === "done"}
        onClose={() => setConfirm(null)}
        onConfirm={() => changeStatus("done")}
        loading={pending}
        title="Marcar visita como realizada?"
        description="A última visita da cidade será atualizada. Clientes ainda “A visitar” permanecem assim e podem ser registrados depois."
        confirmLabel="Marcar como realizada"
      />
      <ConfirmDialog
        open={confirm === "cancel"}
        onClose={() => setConfirm(null)}
        onConfirm={() => changeStatus("cancelled")}
        loading={pending}
        tone="danger"
        title="Cancelar esta visita?"
        description="A visita sai do roteiro e da próxima visita da cidade. Você pode reabri-la depois."
        confirmLabel="Cancelar visita"
      />
      <ConfirmDialog
        open={confirm === "delete"}
        onClose={() => setConfirm(null)}
        onConfirm={remove}
        loading={pending}
        tone="danger"
        title="Excluir visita?"
        description="Nenhum atendimento foi registrado, então a visita pode ser excluída. A exclusão fica registrada no histórico."
        confirmLabel="Excluir visita"
      />
    </>
  );
}
