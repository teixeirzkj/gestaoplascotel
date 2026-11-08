"use client";

import { forwardRef, useId, cloneElement, isValidElement } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoneyInput, maskPhone } from "@/lib/format";
import { parseBRL } from "@/lib/money";

// Campos com 16px no mobile (evita zoom automático do iOS) e altura ≥44px.
const base =
  "w-full rounded-xl border border-line-strong bg-bg-elevated px-3.5 text-base text-fg placeholder:text-fg-subtle " +
  "transition-[border-color,box-shadow] duration-150 outline-none sm:text-sm " +
  "focus:border-bronze focus:ring-2 focus:ring-bronze/25 disabled:opacity-50 aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/25";

export const inputClasses = (className?: string) => cn(base, "h-11", className);

/** Rótulo visível + mensagem de erro abaixo do campo + texto de ajuda. */
export function Field({
  label,
  error,
  hint,
  required,
  className,
  children,
  htmlFor,
}: {
  label: React.ReactNode;
  error?: string;
  hint?: React.ReactNode;
  required?: boolean;
  className?: string;
  htmlFor?: string;
  children: React.ReactElement<{ id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string }>;
}) {
  const autoId = useId();
  const id = htmlFor ?? children.props.id ?? autoId;
  const errId = `${id}-err`;
  const hintId = `${id}-hint`;
  const child = isValidElement(children)
    ? cloneElement(children, {
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": [error ? errId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined,
      })
    : children;
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-fg-muted">
        {label}
        {required && <span className="ml-0.5 text-bronze" aria-hidden>*</span>}
      </label>
      {child}
      {hint && !error && (
        <p id={hintId} className="text-[12px] text-fg-subtle">
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} role="alert" className="text-[12px] font-medium text-danger-fg">
          {error}
        </p>
      )}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={inputClasses(className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, rows = 3, ...props },
  ref,
) {
  return <textarea ref={ref} rows={rows} className={cn(base, "min-h-[88px] resize-y py-2.5 leading-relaxed", className)} {...props} />;
});

/** Select nativo estilizado (melhor experiência no celular). */
export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(inputClasses(), "cursor-pointer appearance-none pr-10", className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" aria-hidden />
    </div>
  );
});

/**
 * Campo monetário com máscara brasileira e teclado numérico.
 * value/onChange trabalham com number (reais, 2 casas).
 */
export const MoneyInput = forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
    value: number | null | undefined;
    onValueChange: (value: number) => void;
  }
>(function MoneyInput({ value, onValueChange, className, ...props }, ref) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-fg-muted">R$</span>
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className={inputClasses(cn("money pl-10 text-right font-medium", className))}
        value={value ? formatMoneyInput(value) : ""}
        placeholder="0,00"
        onChange={(e) => onValueChange(parseBRL(e.target.value))}
        {...props}
      />
    </div>
  );
});

/** Telefone com máscara (XX) XXXXX-XXXX e teclado de telefone. */
export const PhoneInput = forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
    value: string | null | undefined;
    onValueChange: (value: string) => void;
  }
>(function PhoneInput({ value, onValueChange, className, ...props }, ref) {
  return (
    <input
      ref={ref}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      placeholder="(74) 99999-0000"
      className={inputClasses(cn("tabular", className))}
      value={maskPhone(value ?? "")}
      onChange={(e) => onValueChange(maskPhone(e.target.value))}
      {...props}
    />
  );
});

/** Checkbox com área de toque ampla */
export function Checkbox({
  label,
  description,
  checked,
  onChange,
  className,
  id,
}: {
  label: React.ReactNode;
  description?: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
  id?: string;
}) {
  const autoId = useId();
  const cid = id ?? autoId;
  return (
    <label
      htmlFor={cid}
      className={cn(
        "flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-line bg-bg-elevated px-3.5 py-3 transition-colors hover:border-line-strong",
        checked && "border-bronze/50 bg-bronze-soft",
        className,
      )}
    >
      <input
        id={cid}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer accent-[#8b6b4a]"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-fg">{label}</span>
        {description && <span className="mt-0.5 block text-[12px] text-fg-muted">{description}</span>}
      </span>
    </label>
  );
}
