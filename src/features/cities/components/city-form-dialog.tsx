"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { BR_STATES } from "../schemas";
import { saveCityAction } from "../actions";

export type CityFormValues = { id?: string; name: string; state: string; notes: string | null };

/**
 * Cadastro/edição de cidade (somente proprietário — a action valida com assertOwner e o banco com RLS).
 * Renderize com `key` diferente a cada abertura para reiniciar o formulário.
 */
export function CityFormDialog({
  open,
  onClose,
  city,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  city?: CityFormValues | null;
  onSaved?: (id: string) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(city?.name ?? "");
  const [state, setState] = useState(city?.state ?? "BA");
  const [notes, setNotes] = useState(city?.notes ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const editing = Boolean(city?.id);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r = await saveCityAction({ id: city?.id, name, state, notes });
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        toast.error(r.error);
        return;
      }
      setErrors({});
      toast.success(r.message ?? "Cidade salva.");
      onSaved?.(r.data.id);
      onClose();
      router.refresh();
    });
  }

  return (
    <Modal
      open={open}
      onClose={() => !pending && onClose()}
      title={editing ? "Editar cidade" : "Nova cidade"}
      description={editing ? "As alterações ficam registradas no histórico." : "Cidades organizam clientes, cobranças e o roteiro de visitas."}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" form="city-form" loading={pending}>
            {editing ? "Salvar alterações" : "Cadastrar cidade"}
          </Button>
        </>
      }
    >
      <form id="city-form" onSubmit={submit} className="grid gap-4" noValidate>
        <div className="grid grid-cols-[1fr_104px] gap-3">
          <Field label="Nome" required error={errors.name}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Juazeiro" autoComplete="off" maxLength={80} />
          </Field>
          <Field label="UF" required error={errors.state}>
            <Select value={state} onChange={(e) => setState(e.target.value)}>
              {BR_STATES.map((s) => (
                <option key={s.value} value={s.value} title={s.label}>
                  {s.value}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Observações" error={errors.notes} hint="Ex.: melhor dia para visitar, pontos de referência, rotas.">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} placeholder="Opcional" />
        </Field>
      </form>
    </Modal>
  );
}
