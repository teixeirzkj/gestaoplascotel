"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Segmented } from "@/components/ui/tabs";
import { NOTE_KIND } from "@/lib/labels";
import { addCustomerNoteAction } from "../actions";
import { NOTE_KINDS } from "../schemas";

type Kind = (typeof NOTE_KINDS)[number];
const KIND_OPTIONS = NOTE_KINDS.map((k) => ({ value: k, label: NOTE_KIND[k] }));
const KIND_HINT: Record<Kind, string> = {
  note: "Informação geral sobre o cliente.",
  contact: "Conversa ou tentativa de contato. Atualiza o “último contato”.",
  collection: "Cobrança realizada. Atualiza o “último contato”.",
};

function useNoteSubmit(customerId: string, onDone?: () => void) {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>("note");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (body.trim().length < 2) {
      setError("Escreva a observação");
      return;
    }
    setSaving(true);
    setError(null);
    const r = await addCustomerNoteAction({ customer_id: customerId, kind, body });
    setSaving(false);
    if (!r.ok) {
      setError(r.fieldErrors?.body ?? null);
      toast.error(r.error);
      return;
    }
    toast.success(r.message ?? "Observação registrada");
    setBody("");
    setKind("note");
    router.refresh();
    onDone?.();
  }

  return { kind, setKind, body, setBody, error, saving, submit };
}

function NoteFields({ state }: { state: ReturnType<typeof useNoteSubmit> }) {
  return (
    <div className="space-y-3">
      <Segmented options={KIND_OPTIONS} value={state.kind} onChange={state.setKind} />
      <Field label="Texto" required error={state.error ?? undefined} hint={KIND_HINT[state.kind]}>
        <Textarea
          rows={3}
          maxLength={2000}
          value={state.body}
          onChange={(e) => state.setBody(e.target.value)}
          placeholder={state.kind === "note" ? "Escreva a observação" : state.kind === "contact" ? "Ex.: Ligou dizendo que paga sexta" : "Ex.: Cobrado no WhatsApp, aguardando retorno"}
        />
      </Field>
    </div>
  );
}

/** Formulário inline (aba Observações). Qualquer usuário ativo pode registrar. */
export function NoteForm({ customerId }: { customerId: string }) {
  const state = useNoteSubmit(customerId);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void state.submit();
      }}
      className="space-y-3"
    >
      <NoteFields state={state} />
      <div className="flex justify-end">
        <Button type="submit" loading={state.saving} className="w-full sm:w-auto">
          Registrar
        </Button>
      </div>
    </form>
  );
}

/** Versão em modal (ação rápida no cabeçalho da ficha). */
export function NoteDialog({ open, onClose, customerId, customerName }: { open: boolean; onClose: () => void; customerId: string; customerName: string }) {
  const state = useNoteSubmit(customerId, onClose);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nova observação"
      description={customerName}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={state.saving}>
            Cancelar
          </Button>
          <Button loading={state.saving} onClick={() => void state.submit()}>
            Registrar
          </Button>
        </>
      }
    >
      <NoteFields state={state} />
    </Modal>
  );
}
