"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Info } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { useUrlParams } from "@/components/ui/url-controls";
import { todayISO } from "@/lib/dates";
import { createVisitAction } from "../actions";
import type { CityOption } from "../types";
import { CustomerPicker } from "./customer-picker";

/** Formulário de nova visita. Monte com `key` novo a cada abertura para reiniciar. */
export function NewVisitDialog({
  open,
  onClose,
  cities,
  defaultCityId,
  defaultDate,
}: {
  open: boolean;
  onClose: () => void;
  cities: CityOption[];
  defaultCityId?: string | null;
  defaultDate?: string | null;
}) {
  const router = useRouter();
  const [cityId, setCityId] = useState(defaultCityId && cities.some((c) => c.id === defaultCityId) ? defaultCityId : "");
  const [date, setDate] = useState(defaultDate || todayISO());
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!cityId) {
      setErrors({ cityId: "Selecione a cidade." });
      return;
    }
    startTransition(async () => {
      const r = await createVisitAction({ cityId, date, time, notes, customerIds: Array.from(selected) });
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        toast.error(r.error);
        return;
      }
      toast.success(r.message ?? "Visita agendada.");
      onClose();
      router.push(`/agenda/${r.data.id}`);
    });
  }

  return (
    <Modal
      open={open}
      onClose={() => !pending && onClose()}
      title="Agendar visita"
      description="Escolha a cidade, a data e os clientes que serão visitados."
      size="lg"
      footer={
        cities.length > 0 ? (
          <>
            <Button variant="ghost" onClick={onClose} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" form="new-visit-form" loading={pending} disabled={!cityId}>
              <CalendarPlus className="h-4 w-4" />
              Agendar{selected.size > 0 ? ` com ${selected.size} ${selected.size === 1 ? "cliente" : "clientes"}` : " visita"}
            </Button>
          </>
        ) : undefined
      }
    >
      {cities.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-[15px] font-semibold text-fg">Nenhuma cidade ativa</p>
          <p className="mx-auto mt-1 max-w-sm text-[13px] text-fg-muted">Visitas são organizadas por cidade. Cadastre uma cidade para começar a agendar.</p>
          <ButtonLink href="/cidades" variant="secondary" size="sm" className="mt-4">
            Ir para cidades
          </ButtonLink>
        </div>
      ) : (
        <form id="new-visit-form" onSubmit={submit} className="grid gap-4" noValidate>
          <Field label="Cidade" required error={errors.cityId}>
            <Select
              value={cityId}
              onChange={(e) => {
                setCityId(e.target.value);
                setSelected(new Set());
                setErrors((x) => ({ ...x, cityId: "" }));
              }}
            >
              <option value="">Selecione…</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}/{c.state}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data da visita" required error={errors.date}>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="tabular" />
            </Field>
            <Field label="Horário" error={errors.time} hint="Opcional">
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="tabular" />
            </Field>
          </div>
          <p className="-mt-1 flex items-start gap-2 rounded-xl bg-bronze-soft px-3 py-2.5 text-[12.5px] leading-relaxed text-fg-muted">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-bronze" aria-hidden />
            A data de visita é independente do vencimento financeiro e da data de cobrança das parcelas — agendar não altera nenhuma delas.
          </p>
          <Field label="Observações" error={errors.notes}>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={1000} placeholder="Opcional — ex.: levar catálogo novo" />
          </Field>
          <div className="border-t border-line pt-4">
            <p className="mb-3 text-[15px] font-semibold text-fg">Clientes a visitar</p>
            {cityId ? (
              <CustomerPicker cityId={cityId} selected={selected} onChange={setSelected} preselect />
            ) : (
              <p className="rounded-xl border border-dashed border-line px-4 py-4 text-center text-[13px] text-fg-subtle">
                Selecione a cidade para ver os clientes sugeridos.
              </p>
            )}
          </div>
        </form>
      )}
    </Modal>
  );
}

/**
 * Botão "Nova visita". Abre automaticamente com ?nova=1 (e ?cidade=<id>, ?dia=YYYY-MM-DD opcionais)
 * e limpa esses parâmetros ao fechar.
 */
export function NewVisitButton({
  cities,
  autoOpen,
  defaultCityId,
  defaultDate,
  label = "Nova visita",
  variant = "primary",
  className,
}: {
  cities: CityOption[];
  autoOpen?: boolean;
  defaultCityId?: string | null;
  defaultDate?: string | null;
  label?: string;
  variant?: "primary" | "secondary";
  className?: string;
}) {
  const { params, set } = useUrlParams();
  const [open, setOpen] = useState(Boolean(autoOpen));
  const [formKey, setFormKey] = useState(0);
  const [defaults, setDefaults] = useState({ cityId: defaultCityId ?? null, date: defaultDate ?? null });

  const close = () => {
    setOpen(false);
    if (params.get("nova") || params.get("cidade") || params.get("dia")) set({ nova: null, cidade: null, dia: null }, { resetPage: false });
  };

  return (
    <>
      <Button
        variant={variant}
        className={className}
        onClick={() => {
          setDefaults({ cityId: defaultCityId ?? null, date: defaultDate ?? null });
          setFormKey((k) => k + 1);
          setOpen(true);
        }}
      >
        <CalendarPlus className="h-4 w-4" /> {label}
      </Button>
      <NewVisitDialog key={formKey} open={open} onClose={close} cities={cities} defaultCityId={defaults.cityId} defaultDate={defaults.date} />
    </>
  );
}
