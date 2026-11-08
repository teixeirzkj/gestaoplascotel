"use client";

import { forwardRef, useState } from "react";
import { Copy, Eye, EyeOff, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { inputClasses } from "@/components/ui/field";
import { cn } from "@/lib/utils";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/** Senha temporária legível (sem caracteres ambíguos), gerada com crypto seguro. */
export function generatePassword(length = 12): string {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  // garante ao menos um dígito
  return /\d/.test(out) ? out : out.slice(0, -1) + String(bytes[0] % 10);
}

/** Campo de senha com mostrar/ocultar, gerar e copiar. */
export const PasswordField = forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
    value: string;
    onValueChange: (v: string) => void;
  }
>(function PasswordField({ value, onValueChange, className, ...props }, ref) {
  const [visible, setVisible] = useState(true);
  const btn =
    "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-white/5 hover:text-fg";
  return (
    <div className="relative">
      <input
        ref={ref}
        type={visible ? "text" : "password"}
        autoComplete="new-password"
        spellCheck={false}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        className={inputClasses(cn("pr-[7.5rem] font-mono tracking-wide", className))}
        {...props}
      />
      <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center">
        <button type="button" className={btn} onClick={() => setVisible((v) => !v)} aria-label={visible ? "Ocultar senha" : "Mostrar senha"}>
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
        <button
          type="button"
          className={btn}
          aria-label="Gerar senha"
          title="Gerar senha"
          onClick={() => {
            onValueChange(generatePassword());
            setVisible(true);
          }}
        >
          <RefreshCw className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={btn}
          aria-label="Copiar senha"
          title="Copiar senha"
          disabled={!value}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              toast.success("Senha copiada");
            } catch {
              toast.error("Não foi possível copiar. Selecione e copie manualmente.");
            }
          }}
        >
          <Copy className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
});
