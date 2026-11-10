"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Building2, CalendarClock, Save, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, PhoneInput } from "@/components/ui/field";
import { formatDateTime } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/labels";
import { updateBillingSettingsAction, updateCompanySettingsAction, updateMyNameAction } from "../actions";
import {
  billingSchema, companySchema, profileNameSchema,
  type BillingInput, type BillingSettings, type CompanyInput, type CompanySettings,
} from "../schemas";

function FormFooter({ dirty, pending, updatedAt, idle = "Valores padrão do sistema" }: { dirty: boolean; pending: boolean; updatedAt?: string | null; idle?: string }) {
  return (
    <div className="mt-5 flex flex-col-reverse gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[12px] text-fg-subtle">
        {dirty ? "Alterações não salvas" : updatedAt ? `Atualizado em ${formatDateTime(updatedAt)}` : idle}
      </p>
      <Button type="submit" loading={pending} disabled={!dirty} className="w-full sm:w-auto">
        {!pending && <Save className="h-4 w-4" aria-hidden />} Salvar
      </Button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export function CompanyForm({ initial, updatedAt }: { initial: CompanySettings; updatedAt: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty },
  } = useForm<CompanyInput, unknown, CompanySettings>({
    resolver: zodResolver(companySchema),
    defaultValues: { name: initial.name, document: initial.document ?? "", phone: initial.phone ?? "", pix_key: initial.pix_key ?? "" },
  });

  const onSubmit = (values: CompanySettings) =>
    startTransition(async () => {
      const r = await updateCompanySettingsAction(values);
      if (!r.ok) {
        Object.entries(r.fieldErrors ?? {}).forEach(([k, m]) => setError(k as keyof CompanyInput, { message: m }));
        toast.error(r.error);
        return;
      }
      toast.success(r.message ?? "Salvo");
      reset({ name: values.name, document: values.document ?? "", phone: values.phone ?? "", pix_key: values.pix_key ?? "" });
      router.refresh();
    });

  return (
    <Card>
      <CardHeader title="Empresa" description="Dados exibidos em recibos e mensagens de cobrança." icon={<Building2 className="h-4 w-4" />} />
      <CardBody>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nome da empresa" required error={errors.name?.message} className="sm:col-span-2">
              <Input autoComplete="organization" {...register("name")} />
            </Field>
            <Field label="CNPJ / CPF" error={errors.document?.message}>
              <Input inputMode="numeric" placeholder="00.000.000/0000-00" {...register("document")} />
            </Field>
            {/* Controller não repassa id/aria do Field: o vínculo com o rótulo é explícito (htmlFor/id). */}
            <Field label="Telefone" htmlFor="company-phone" error={errors.phone?.message}>
              <Controller
                control={control}
                name="phone"
                render={({ field }) => (
                  <PhoneInput
                    id="company-phone"
                    value={field.value}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                    aria-invalid={errors.phone ? true : undefined}
                    aria-describedby={errors.phone ? "company-phone-err" : undefined}
                  />
                )}
              />
            </Field>
            <Field
              label="Chave Pix"
              error={errors.pix_key?.message}
              hint="Usada para informar o cliente na hora de cobrar. Nenhuma mensagem é enviada automaticamente."
              className="sm:col-span-2"
            >
              <Input autoComplete="off" placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória" {...register("pix_key")} />
            </Field>
          </div>
          <FormFooter dirty={isDirty} pending={pending} updatedAt={updatedAt} />
        </form>
      </CardBody>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */

export function BillingForm({ initial, updatedAt }: { initial: BillingSettings; updatedAt: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<BillingInput, unknown, BillingSettings>({
    resolver: zodResolver(billingSchema),
    defaultValues: initial,
  });

  const onSubmit = (values: BillingSettings) =>
    startTransition(async () => {
      const r = await updateBillingSettingsAction(values);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(r.message ?? "Salvo");
      reset(values);
      router.refresh();
    });

  const numberProps = { type: "number", inputMode: "numeric" as const, className: "tabular" };

  return (
    <Card>
      <CardHeader title="Cobrança" description="Padrões para novas vendas e para os avisos do sistema." icon={<CalendarClock className="h-4 w-4" />} />
      <CardBody>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Intervalo entre parcelas" required error={errors.default_interval_days?.message} hint="Em dias (ex.: 30 = mensal)">
              <Input {...numberProps} min={1} max={365} {...register("default_interval_days")} />
            </Field>
            <Field label="Aviso de vencimento" required error={errors.due_soon_days?.message} hint="Dias antes da data de cobrança">
              <Input {...numberProps} min={0} max={30} {...register("due_soon_days")} />
            </Field>
            <Field label="Aviso de visita" required error={errors.visit_soon_days?.message} hint="Dias antes da visita à cidade">
              <Input {...numberProps} min={0} max={30} {...register("visit_soon_days")} />
            </Field>
          </div>
          <FormFooter dirty={isDirty} pending={pending} updatedAt={updatedAt} />
        </form>
      </CardBody>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */

type ProfileValues = { full_name: string };

export function ProfileForm({ name, email, role, createdAt }: { name: string; email: string | null; role: string; createdAt: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileValues>({ resolver: zodResolver(profileNameSchema), defaultValues: { full_name: name } });

  const onSubmit = (values: ProfileValues) =>
    startTransition(async () => {
      const r = await updateMyNameAction(values);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(r.message ?? "Salvo");
      reset(values);
      router.refresh();
    });

  return (
    <Card>
      <CardHeader title="Meu perfil" description="Como seu nome aparece no sistema e no histórico." icon={<UserRound className="h-4 w-4" />} />
      <CardBody>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nome completo" required error={errors.full_name?.message} className="sm:col-span-2">
              <Input autoComplete="name" {...register("full_name")} />
            </Field>
            <div className="rounded-xl border border-line bg-bg-elevated px-3.5 py-3">
              <p className="text-[12px] text-fg-muted">E-mail de acesso</p>
              <p className="mt-0.5 truncate text-sm font-medium text-fg">{email ?? "—"}</p>
            </div>
            <div className="rounded-xl border border-line bg-bg-elevated px-3.5 py-3">
              <p className="text-[12px] text-fg-muted">Papel</p>
              <p className="mt-0.5 text-sm font-medium text-bronze">{ROLE_LABEL[role] ?? role}</p>
            </div>
          </div>
          <FormFooter dirty={isDirty} pending={pending} updatedAt={null} idle="Nenhuma alteração pendente" />
          <p className="mt-2 text-[12px] text-fg-subtle">Usuário desde {formatDateTime(createdAt)}.</p>
        </form>
      </CardBody>
    </Card>
  );
}
