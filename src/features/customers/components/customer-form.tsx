"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { Copy, MapPin, Plus, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, PhoneInput, Select, Textarea } from "@/components/ui/field";
import { ease } from "@/lib/motion";
import { createCityAction, createCustomerAction, updateCustomerAction } from "../actions";
import { customerFormSchema, onlyDigits, type CustomerFormValues } from "../schemas";
import type { CityOption } from "../types";

const NEW_CITY = "__new__";

export function CustomerForm({
  mode,
  customerId,
  defaultValues,
  cities: initialCities,
}: {
  mode: "create" | "edit";
  customerId?: string;
  defaultValues?: Partial<CustomerFormValues>;
  cities: CityOption[];
}) {
  const router = useRouter();
  const [cities, setCities] = useState(initialCities);
  const [addingCity, setAddingCity] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      full_name: "",
      phone: "",
      whatsapp: "",
      city_id: "",
      neighborhood: "",
      address: "",
      reference: "",
      notes: "",
      ...defaultValues,
    },
  });

  async function onSubmit(values: CustomerFormValues) {
    const result =
      mode === "edit" && customerId ? await updateCustomerAction({ ...values, id: customerId }) : await createCustomerAction(values);
    if (!result.ok) {
      if (result.fieldErrors) {
        for (const [k, msg] of Object.entries(result.fieldErrors)) {
          if (k in values) setError(k as keyof CustomerFormValues, { message: msg });
        }
      }
      toast.error(result.error);
      return;
    }
    toast.success(result.message ?? "Salvo");
    router.push(`/clientes/${result.data.id}`);
    router.refresh();
  }

  function copyPhone() {
    const phone = getValues("phone");
    if (onlyDigits(phone).length === 0) {
      toast.info("Preencha o telefone primeiro.");
      return;
    }
    setValue("whatsapp", phone, { shouldDirty: true, shouldValidate: true });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <Card>
        <CardHeader title="Identificação e contato" icon={<UserRound className="h-4 w-4" />} />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome completo" required error={errors.full_name?.message} className="sm:col-span-2">
            <Input autoComplete="name" autoCapitalize="words" placeholder="Ex.: Maria da Silva Santos" {...register("full_name")} />
          </Field>
          {/* Controller não repassa id/aria do Field: o vínculo com o rótulo é explícito (htmlFor/id). */}
          <Field label="Telefone" htmlFor="customer-phone" error={errors.phone?.message} hint="DDD + número">
            <Controller
              control={control}
              name="phone"
              render={({ field }) => (
                <PhoneInput
                  id="customer-phone"
                  ref={field.ref}
                  name={field.name}
                  value={field.value}
                  onBlur={field.onBlur}
                  onValueChange={field.onChange}
                  aria-invalid={errors.phone ? true : undefined}
                  aria-describedby={errors.phone ? "customer-phone-err" : "customer-phone-hint"}
                />
              )}
            />
          </Field>
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="customer-whatsapp" className="text-[13px] font-medium text-fg-muted">
                WhatsApp
              </label>
              <button
                type="button"
                onClick={copyPhone}
                className="-my-2 inline-flex h-9 cursor-pointer items-center gap-1 rounded-lg px-2 text-[12px] font-medium text-bronze transition-colors hover:bg-bronze-soft"
              >
                <Copy className="h-3.5 w-3.5" aria-hidden /> Mesmo do telefone
              </button>
            </div>
            <Controller
              control={control}
              name="whatsapp"
              render={({ field }) => (
                <PhoneInput
                  id="customer-whatsapp"
                  ref={field.ref}
                  name={field.name}
                  value={field.value}
                  onBlur={field.onBlur}
                  onValueChange={field.onChange}
                  aria-invalid={errors.whatsapp ? true : undefined}
                  aria-describedby={errors.whatsapp ? "customer-whatsapp-err" : undefined}
                />
              )}
            />
            {errors.whatsapp && (
              <p id="customer-whatsapp-err" role="alert" className="text-[12px] font-medium text-danger-fg">
                {errors.whatsapp.message}
              </p>
            )}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Endereço" description="Ajuda nas visitas e cobranças presenciais." icon={<MapPin className="h-4 w-4" />} />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Controller
              control={control}
              name="city_id"
              render={({ field }) => (
                <Field label="Cidade" error={errors.city_id?.message}>
                  <Select
                    ref={field.ref}
                    name={field.name}
                    value={addingCity ? NEW_CITY : field.value}
                    onBlur={field.onBlur}
                    onChange={(e) => {
                      if (e.target.value === NEW_CITY) {
                        setAddingCity(true);
                        return;
                      }
                      setAddingCity(false);
                      field.onChange(e.target.value);
                    }}
                  >
                    <option value="">Sem cidade definida</option>
                    {cities.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}/{c.state}
                      </option>
                    ))}
                    <option value={NEW_CITY}>+ Cadastrar nova cidade…</option>
                  </Select>
                </Field>
              )}
            />
            <AnimatePresence initial={false}>
              {addingCity && (
                <QuickCityForm
                  onCancel={() => setAddingCity(false)}
                  onCreated={(city) => {
                    setCities((list) =>
                      list.some((c) => c.id === city.id) ? list : [...list, city].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
                    );
                    setValue("city_id", city.id, { shouldDirty: true, shouldValidate: true });
                    setAddingCity(false);
                  }}
                />
              )}
            </AnimatePresence>
          </div>
          <Field label="Bairro" error={errors.neighborhood?.message}>
            <Input placeholder="Ex.: Centro" {...register("neighborhood")} />
          </Field>
          <Field label="Endereço" error={errors.address?.message}>
            <Input autoComplete="street-address" placeholder="Rua, número" {...register("address")} />
          </Field>
          <Field label="Ponto de referência" error={errors.reference?.message} className="sm:col-span-2">
            <Input placeholder="Ex.: Casa azul ao lado da padaria" {...register("reference")} />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <Field label="Observações do cadastro" error={errors.notes?.message} hint="Visível para toda a equipe na ficha do cliente.">
            <Textarea rows={4} placeholder="Preferências, melhor horário para contato, etc." {...register("notes")} />
          </Field>
        </CardBody>
      </Card>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-col-reverse gap-2 border-t border-line bg-bg/90 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:flex-row sm:justify-end sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <Button variant="ghost" onClick={() => router.back()} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" loading={isSubmitting} disabled={mode === "edit" && !isDirty} className="sm:min-w-40">
          {mode === "edit" ? "Salvar alterações" : "Cadastrar cliente"}
        </Button>
      </div>
    </form>
  );
}

function QuickCityForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: (city: CityOption) => void }) {
  const [name, setName] = useState("");
  const [state, setState] = useState("BA");
  const [saving, setSaving] = useState(false);
  const [error, setErrorMsg] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setErrorMsg(null);
    const r = await createCityAction({ name, state });
    setSaving(false);
    if (!r.ok) {
      setErrorMsg(r.error);
      return;
    }
    toast.success(r.message ?? "Cidade cadastrada");
    onCreated(r.data);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.2, ease: ease.out } }}
      exit={{ opacity: 0, y: -4, transition: { duration: 0.13 } }}
      className="mt-3 rounded-xl border border-bronze/30 bg-bronze-soft p-3"
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[13px] font-semibold text-fg">Nova cidade</p>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancelar nova cidade"
          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-fg-muted hover:bg-white/5 hover:text-fg"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_76px] gap-2">
        <Input
          aria-label="Nome da cidade"
          placeholder="Nome da cidade"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (name.trim().length >= 2) void save();
            }
          }}
        />
        <Input
          aria-label="UF"
          maxLength={2}
          value={state}
          onChange={(e) => setState(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
          className="text-center uppercase"
        />
      </div>
      {error && (
        <p role="alert" className="mt-2 text-[12px] font-medium text-danger-fg">
          {error}
        </p>
      )}
      <Button size="sm" className="mt-2.5 w-full sm:w-auto" loading={saving} disabled={name.trim().length < 2 || state.length !== 2} onClick={save}>
        <Plus className="h-4 w-4" /> Adicionar cidade
      </Button>
    </motion.div>
  );
}
