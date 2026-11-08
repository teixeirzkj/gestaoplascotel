"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Copy, KeyRound, Power, ShieldCheck, UserCog, UserPlus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Avatar, ConfirmDialog, Table, Td, Th, Tr } from "@/components/ui/misc";
import { Modal } from "@/components/ui/modal";
import { MotionItem, MotionList } from "@/components/ui/motion-list";
import { EmptyState } from "@/components/ui/states";
import { useShellUser } from "@/components/layout/app-shell";
import { formatDate, formatDateTime } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { ManagedUser } from "../queries";
import { createUserAction, resetUserPasswordAction, setUserActiveAction, updateUserRoleAction } from "../actions";
import { PasswordField, generatePassword } from "./password-field";

type Role = "owner" | "employee";
type Dialog = { kind: "role" | "password" | "active"; user: ManagedUser } | { kind: "create" } | null;

export function UsersSection({ users, authAvailable }: { users: ManagedUser[]; authAvailable: boolean }) {
  const me = useShellUser();
  const [dialog, setDialog] = useState<Dialog>(null);
  const close = () => setDialog(null);
  const activeCount = users.filter((u) => u.active).length;

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Usuários"
        description={`${activeCount} ${activeCount === 1 ? "usuário ativo" : "usuários ativos"} · ${users.length} no total`}
        icon={<Users className="h-4 w-4" />}
        action={
          <Button size="sm" onClick={() => setDialog({ kind: "create" })} disabled={!authAvailable}>
            <UserPlus className="h-4 w-4" aria-hidden /> <span className="hidden xs:inline">Novo usuário</span>
            <span className="xs:hidden">Novo</span>
          </Button>
        }
      />
      {!authAvailable && (
        <p role="alert" className="mx-4 mt-3 rounded-xl bg-warning-soft px-3 py-2.5 text-[13px] text-warning sm:mx-5">
          A chave secreta do Supabase não está configurada no servidor: criar usuários, redefinir senhas e bloquear acessos ficam indisponíveis.
        </p>
      )}

      {users.length === 0 ? (
        <EmptyState
          compact
          title="Nenhum usuário"
          description="Crie o acesso dos funcionários."
          action={
            <Button size="sm" onClick={() => setDialog({ kind: "create" })} disabled={!authAvailable}>
              <UserPlus className="h-4 w-4" aria-hidden /> Novo usuário
            </Button>
          }
        />
      ) : (
        <>
          {/* Celular: cards */}
          <MotionList as="ul" className="mt-3 divide-y divide-line border-t border-line md:hidden">
            {users.map((u) => (
              <MotionItem as="li" key={u.id} className="px-4 py-3.5">
                <div className="flex items-start gap-3">
                  <Avatar name={u.full_name} className={cn(!u.active && "opacity-50")} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-[15px] font-semibold text-fg">
                      <span className="truncate">{u.full_name || "Sem nome"}</span>
                      {u.id === me.id && <span className="shrink-0 text-[12px] font-normal text-fg-subtle">(você)</span>}
                    </p>
                    <p className="truncate text-[13px] text-fg-muted">{u.email ?? "—"}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <RoleBadge role={u.role} />
                      <ActiveBadge active={u.active} />
                    </div>
                    <p className="mt-2 text-[12px] text-fg-subtle">
                      Criado em {formatDate(u.created_at)} · {u.last_sign_in_at ? `último acesso ${formatDateTime(u.last_sign_in_at)}` : "nunca acessou"}
                    </p>
                  </div>
                </div>
                <UserActions user={u} isMe={u.id === me.id} authAvailable={authAvailable} onOpen={setDialog} className="mt-3" />
              </MotionItem>
            ))}
          </MotionList>

          {/* Desktop: tabela */}
          <div className="mt-3 hidden md:block">
            <Table>
              <thead>
                <tr>
                  <Th>Usuário</Th>
                  <Th>Papel</Th>
                  <Th>Situação</Th>
                  <Th>Criado em</Th>
                  <Th>Último acesso</Th>
                  <Th className="text-right">Ações</Th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <Tr key={u.id}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar name={u.full_name} className={cn("h-9 w-9", !u.active && "opacity-50")} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-fg">
                            {u.full_name || "Sem nome"}
                            {u.id === me.id && <span className="ml-1.5 text-[12px] font-normal text-fg-subtle">(você)</span>}
                          </p>
                          <p className="truncate text-[12.5px] text-fg-muted">{u.email ?? "—"}</p>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <RoleBadge role={u.role} />
                    </Td>
                    <Td>
                      <ActiveBadge active={u.active} />
                    </Td>
                    <Td className="tabular whitespace-nowrap text-fg-muted">{formatDate(u.created_at)}</Td>
                    <Td className="tabular whitespace-nowrap text-fg-muted">{u.last_sign_in_at ? formatDateTime(u.last_sign_in_at) : "Nunca"}</Td>
                    <Td className="text-right">
                      <UserActions user={u} isMe={u.id === me.id} authAvailable={authAvailable} onOpen={setDialog} className="justify-end" compact />
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
        </>
      )}

      <CreateUserDialog open={dialog?.kind === "create"} onClose={close} />
      {dialog && dialog.kind === "role" && <RoleDialog user={dialog.user} isMe={dialog.user.id === me.id} onClose={close} />}
      {dialog && dialog.kind === "password" && <PasswordDialog user={dialog.user} onClose={close} />}
      {dialog && dialog.kind === "active" && <ActiveDialog user={dialog.user} onClose={close} />}
    </Card>
  );
}

function RoleBadge({ role }: { role: string }) {
  return (
    <Badge tone={role === "owner" ? "brand" : "neutral"} dot={false}>
      {role === "owner" && <ShieldCheck className="h-3.5 w-3.5" aria-hidden />}
      {ROLE_LABEL[role] ?? role}
    </Badge>
  );
}

function ActiveBadge({ active }: { active: boolean }) {
  return <Badge tone={active ? "success" : "muted"}>{active ? "Ativo" : "Desativado"}</Badge>;
}

function UserActions({
  user,
  isMe,
  authAvailable,
  onOpen,
  className,
  compact,
}: {
  user: ManagedUser;
  isMe: boolean;
  authAvailable: boolean;
  onOpen: (d: Dialog) => void;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Button variant="secondary" size="sm" onClick={() => onOpen({ kind: "role", user })} title="Alterar papel">
        <UserCog className="h-4 w-4" aria-hidden /> {compact ? <span className="sr-only">Alterar papel</span> : "Papel"}
      </Button>
      <Button variant="secondary" size="sm" onClick={() => onOpen({ kind: "password", user })} disabled={!authAvailable} title="Redefinir senha">
        <KeyRound className="h-4 w-4" aria-hidden /> {compact ? <span className="sr-only">Redefinir senha</span> : "Senha"}
      </Button>
      {!isMe && (
        <Button
          variant={user.active ? "ghost" : "secondary"}
          size="sm"
          onClick={() => onOpen({ kind: "active", user })}
          disabled={!authAvailable}
          title={user.active ? "Desativar usuário" : "Reativar usuário"}
          className={cn(user.active && "text-danger-fg hover:bg-danger-soft hover:text-danger-fg")}
        >
          <Power className="h-4 w-4" aria-hidden />
          {compact ? <span className="sr-only">{user.active ? "Desativar" : "Reativar"}</span> : user.active ? "Desativar" : "Reativar"}
        </Button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function RoleOption({ value, current, onSelect, title, description }: { value: Role; current: Role; onSelect: (r: Role) => void; title: string; description: string }) {
  const active = value === current;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={() => onSelect(value)}
      className={cn(
        "flex w-full cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors",
        active ? "border-bronze/50 bg-bronze-soft" : "border-line bg-bg-elevated hover:border-line-strong",
      )}
    >
      <span className={cn("mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2", active ? "border-bronze" : "border-line-strong")}>
        {active && <span className="h-2 w-2 rounded-full bg-bronze" />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-fg">{title}</span>
        <span className="mt-0.5 block text-[12px] text-fg-muted">{description}</span>
      </span>
    </button>
  );
}

function RolePicker({ value, onChange }: { value: Role; onChange: (r: Role) => void }) {
  return (
    <div role="radiogroup" aria-label="Papel" className="grid gap-2">
      <RoleOption
        value="employee"
        current={value}
        onSelect={onChange}
        title="Funcionário"
        description="Consulta tudo, registra e confirma pagamentos, adiamentos, promessas, observações e visitas."
      />
      <RoleOption
        value="owner"
        current={value}
        onSelect={onChange}
        title="Proprietário"
        description="Acesso total: cadastros, vendas, estornos, caixa, relatórios, configurações e usuários."
      />
    </div>
  );
}

function CreateUserDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("employee");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [wasOpen, setWasOpen] = useState(false);

  // Reinicia o formulário a cada abertura (senha gerada ao abrir)
  if (open && !wasOpen) {
    setWasOpen(true);
    setName("");
    setEmail("");
    setRole("employee");
    setErrors({});
    setCreated(null);
    setPassword(generatePassword());
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  const submit = () =>
    startTransition(async () => {
      const r = await createUserAction({ full_name: name, email, password, role });
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        toast.error(r.error);
        return;
      }
      toast.success(r.message ?? "Usuário criado");
      setCreated({ email: email.trim().toLowerCase(), password });
      router.refresh();
    });

  const copyCredentials = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(`Acesso ao PLASCOTEL\nE-mail: ${created.email}\nSenha temporária: ${created.password}`);
      toast.success("Dados de acesso copiados");
    } catch {
      toast.error("Não foi possível copiar. Anote os dados manualmente.");
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => !pending && onClose()}
      title={created ? "Usuário criado" : "Novo usuário"}
      description={created ? "Envie os dados de acesso ao usuário. A senha não será exibida novamente." : "O acesso é liberado imediatamente, sem confirmação por e-mail."}
      footer={
        created ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Concluir
            </Button>
            <Button onClick={copyCredentials}>
              <Copy className="h-4 w-4" aria-hidden /> Copiar dados de acesso
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={submit} loading={pending} disabled={!name.trim() || !email.trim() || password.length < 8}>
              {!pending && <UserPlus className="h-4 w-4" aria-hidden />} Criar usuário
            </Button>
          </>
        )
      }
    >
      {created ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-xl bg-success-soft px-3.5 py-3 text-success">
            <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden />
            <p className="text-sm font-medium">Acesso criado com sucesso.</p>
          </div>
          <dl className="divide-y divide-line rounded-xl border border-line bg-card">
            <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm">
              <dt className="text-fg-muted">E-mail</dt>
              <dd className="truncate font-medium text-fg">{created.email}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm">
              <dt className="text-fg-muted">Senha temporária</dt>
              <dd className="font-mono font-medium tracking-wide text-fg">{created.password}</dd>
            </div>
          </dl>
          <p className="text-[12px] text-fg-subtle">Recomende que o usuário guarde a senha em local seguro.</p>
        </div>
      ) : (
        <form
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Field label="Nome completo" required error={errors.full_name}>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" data-autofocus />
          </Field>
          <Field label="E-mail" required error={errors.email}>
            <Input type="email" inputMode="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@exemplo.com" />
          </Field>
          <Field label="Senha temporária" required error={errors.password} hint="Gerada automaticamente; você pode alterar. Mínimo de 8 caracteres.">
            <PasswordField value={password} onValueChange={setPassword} />
          </Field>
          <div className="space-y-1.5">
            <p className="text-[13px] font-medium text-fg-muted">Papel</p>
            <RolePicker value={role} onChange={setRole} />
          </div>
          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>
      )}
    </Modal>
  );
}

function RoleDialog({ user, isMe, onClose }: { user: ManagedUser; isMe: boolean; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [role, setRole] = useState<Role>(user.role);
  const demotingMe = isMe && user.role === "owner" && role === "employee";

  const submit = () =>
    startTransition(async () => {
      const r = await updateUserRoleAction({ userId: user.id, role });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(r.message ?? "Papel alterado");
      onClose();
      router.refresh();
    });

  return (
    <Modal
      open
      onClose={() => !pending && onClose()}
      title="Alterar papel"
      description={user.full_name}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button variant={demotingMe ? "danger" : "primary"} onClick={submit} loading={pending} disabled={role === user.role}>
            Salvar papel
          </Button>
        </>
      }
    >
      <RolePicker value={role} onChange={setRole} />
      {demotingMe && (
        <p role="alert" className="mt-3 rounded-xl bg-danger-soft px-3 py-2.5 text-[13px] text-danger-fg">
          Você deixará de ser proprietário e perderá o acesso a esta página. É necessário manter ao menos um proprietário ativo.
        </p>
      )}
    </Modal>
  );
}

function PasswordDialog({ user, onClose }: { user: ManagedUser; onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  const [password, setPassword] = useState(() => generatePassword());
  const [error, setError] = useState<string | undefined>();
  const [done, setDone] = useState(false);

  const submit = () =>
    startTransition(async () => {
      const r = await resetUserPasswordAction({ userId: user.id, password });
      if (!r.ok) {
        setError(r.fieldErrors?.password);
        toast.error(r.error);
        return;
      }
      toast.success(r.message ?? "Senha redefinida");
      setDone(true);
    });

  return (
    <Modal
      open
      onClose={() => !pending && onClose()}
      title="Redefinir senha"
      description={`${user.full_name}${user.email ? ` · ${user.email}` : ""}`}
      size="sm"
      footer={
        done ? (
          <Button onClick={onClose}>Concluir</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={submit} loading={pending} disabled={password.length < 8}>
              {!pending && <KeyRound className="h-4 w-4" aria-hidden />} Redefinir
            </Button>
          </>
        )
      }
    >
      <Field
        label="Nova senha"
        required
        error={error}
        hint={done ? "Senha alterada. Copie e envie ao usuário." : "A senha atual deixa de funcionar imediatamente."}
      >
        <PasswordField value={password} onValueChange={setPassword} readOnly={done} />
      </Field>
    </Modal>
  );
}

function ActiveDialog({ user, onClose }: { user: ManagedUser; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const deactivate = user.active;
  return (
    <ConfirmDialog
      open
      onClose={() => !pending && onClose()}
      loading={pending}
      tone={deactivate ? "danger" : "primary"}
      title={deactivate ? `Desativar ${user.full_name}?` : `Reativar ${user.full_name}?`}
      description={
        deactivate
          ? "O usuário perde o acesso imediatamente e não consegue mais entrar. O histórico dele é mantido."
          : "O usuário volta a acessar o sistema com a senha atual."
      }
      confirmLabel={deactivate ? "Desativar" : "Reativar"}
      onConfirm={() =>
        new Promise<void>((resolve) =>
          startTransition(async () => {
            const r = await setUserActiveAction({ userId: user.id, active: !deactivate });
            if (!r.ok) toast.error(r.error);
            else {
              toast.success(r.message ?? "Atualizado");
              onClose();
              router.refresh();
            }
            resolve();
          }),
        )
      }
    />
  );
}
