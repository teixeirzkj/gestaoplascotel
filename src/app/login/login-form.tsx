"use client";

import { useActionState, useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { loginAction, type LoginState } from "./actions";

export function LoginForm({ next, inactive }: { next?: string; inactive?: boolean }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, {
    error: inactive ? "Seu acesso está desativado. Fale com o proprietário." : undefined,
  });
  const [show, setShow] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="rounded-3xl border border-line-strong bg-bg-elevated/95 p-6 shadow-pop sm:p-8"
    >
      <h1 className="text-xl font-semibold tracking-tight text-fg">Entrar</h1>
      <p className="mt-1 text-sm text-fg-muted">Use o e-mail e a senha cadastrados pelo proprietário.</p>

      <form action={formAction} className="mt-6 space-y-4" noValidate>
        {next && <input type="hidden" name="next" value={next} />}
        <Field label="E-mail" error={state.fieldErrors?.email}>
          <Input name="email" type="email" autoComplete="email" inputMode="email" defaultValue={state.email} placeholder="voce@plascotel.com" required />
        </Field>
        {/* Field aplica id/aria no filho direto; aqui o filho é o wrapper do botão "mostrar senha",
            então o vínculo rótulo → input é feito à mão (senão o campo fica sem nome acessível). */}
        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor="login-password" className="text-[13px] font-medium text-fg-muted">
            Senha
          </label>
          <div className="relative">
            <Input
              id="login-password"
              name="password"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              required
              className="pr-12"
              aria-invalid={state.fieldErrors?.password ? true : undefined}
              aria-describedby={state.fieldErrors?.password ? "login-password-err" : undefined}
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? "Ocultar senha" : "Mostrar senha"}
              className="absolute right-0.5 top-1/2 flex h-11 w-11 -translate-y-1/2 sm:right-1 sm:h-9 sm:w-9 cursor-pointer items-center justify-center rounded-lg text-fg-muted hover:text-fg"
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {state.fieldErrors?.password && (
            <p id="login-password-err" role="alert" className="text-[12px] font-medium text-danger-fg">
              {state.fieldErrors.password}
            </p>
          )}
        </div>
        {state.error && (
          <motion.p
            role="alert"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-danger/30 bg-danger-soft px-3.5 py-2.5 text-[13px] font-medium text-[#fca5a5]"
          >
            {state.error}
          </motion.p>
        )}
        <Button type="submit" size="lg" className="w-full" loading={pending}>
          {!pending && <LogIn className="h-4 w-4" />} Entrar
        </Button>
      </form>
    </motion.div>
  );
}
