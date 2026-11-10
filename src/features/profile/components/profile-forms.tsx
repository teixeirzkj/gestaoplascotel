"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyRound, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { changeMyPasswordAction, updateMyNameAction } from "../actions";

export function NameForm({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  return (
    <Card>
      <CardHeader icon={<UserRound className="h-4 w-4" />} title="Dados pessoais" description="Como seu nome aparece no histórico e nos registros." />
      <CardBody>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            const r = await updateMyNameAction({ fullName: name });
            setLoading(false);
            if (!r.ok) {
              setError(r.fieldErrors?.fullName ?? r.error);
              toast.error(r.error);
              return;
            }
            setError(undefined);
            toast.success(r.message ?? "Salvo.");
            router.refresh();
          }}
        >
          <Field label="Nome completo" required error={error}>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={120} />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" loading={loading} disabled={name.trim() === initialName.trim()}>
              Salvar nome
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

export function PasswordForm() {
  const [values, setValues] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [k]: e.target.value }));

  return (
    <Card>
      <CardHeader
        icon={<KeyRound className="h-4 w-4" />}
        title="Alterar senha"
        description="Mínimo de 8 caracteres, com letras e números. Troque a senha temporária no primeiro acesso."
      />
      <CardBody>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            const r = await changeMyPasswordAction(values);
            setLoading(false);
            if (!r.ok) {
              setErrors(r.fieldErrors ?? {});
              toast.error(r.error);
              return;
            }
            setErrors({});
            setValues({ currentPassword: "", newPassword: "", confirmPassword: "" });
            toast.success(r.message ?? "Senha alterada.");
          }}
        >
          <Field label="Senha atual" required error={errors.currentPassword}>
            <Input type="password" autoComplete="current-password" value={values.currentPassword} onChange={set("currentPassword")} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nova senha" required error={errors.newPassword}>
              <Input type="password" autoComplete="new-password" value={values.newPassword} onChange={set("newPassword")} />
            </Field>
            <Field label="Confirmar nova senha" required error={errors.confirmPassword}>
              <Input type="password" autoComplete="new-password" value={values.confirmPassword} onChange={set("confirmPassword")} />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button type="submit" loading={loading} disabled={!values.currentPassword || !values.newPassword}>
              Alterar senha
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
