"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { inputClasses, Select } from "./field";

/** Atualiza parâmetros da URL (filtros/busca/paginação ficam compartilháveis e sobrevivem ao "voltar"). */
export function useUrlParams() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function set(updates: Record<string, string | null | undefined>, opts: { resetPage?: boolean } = { resetPage: true }) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === undefined || v === "") next.delete(k);
      else next.set(k, v);
    }
    if (opts.resetPage && !("page" in updates)) next.delete("page");
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  return { params, set, pending };
}

/** Busca com debounce (350ms) sincronizada com ?q= */
export function SearchInput({
  placeholder = "Buscar…",
  param = "q",
  className,
  inputMode,
}: {
  placeholder?: string;
  param?: string;
  className?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  const { params, set, pending } = useUrlParams();
  const [value, setValue] = useState(params.get(param) ?? "");
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => set({ [param]: value.trim() || null }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className={cn("relative min-w-0", className)}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
      <input
        type="search"
        value={value}
        inputMode={inputMode}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={inputClasses("pl-10 pr-11 sm:pr-10 [&::-webkit-search-cancel-button]:hidden")}
      />
      {pending ? (
        <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-fg-subtle" aria-hidden />
      ) : (
        value && (
          <button
            type="button"
            onClick={() => setValue("")}
            aria-label="Limpar busca"
            className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 sm:right-1.5 sm:h-8 sm:w-8 cursor-pointer items-center justify-center rounded-lg text-fg-subtle hover:text-fg"
          >
            <X className="h-4 w-4" />
          </button>
        )
      )}
    </div>
  );
}

/** Select de filtro sincronizado com a URL */
export function FilterSelect({
  param,
  options,
  placeholder,
  className,
  label,
}: {
  param: string;
  options: { value: string; label: string }[];
  placeholder: string;
  className?: string;
  label: string;
}) {
  const { params, set } = useUrlParams();
  return (
    <div className={cn("min-w-0", className)}>
      <Select aria-label={label} value={params.get(param) ?? ""} onChange={(e) => set({ [param]: e.target.value || null })}>
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </div>
  );
}

/** Paginação baseada em ?page= (links reais, funciona sem JS) */
export function Pagination({
  page,
  pageSize,
  total,
  className,
}: {
  page: number;
  pageSize: number;
  total: number;
  className?: string;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  const href = (p: number) => {
    const next = new URLSearchParams(params.toString());
    if (p <= 1) next.delete("page");
    else next.set("page", String(p));
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const btn =
    "inline-flex h-11 min-w-11 items-center sm:h-10 sm:min-w-10 justify-center gap-1 rounded-xl border border-line px-3 text-[13px] font-medium transition-colors";
  return (
    <nav aria-label="Paginação" className={cn("flex items-center justify-between gap-3 pt-4", className)}>
      <p className="tabular text-[12px] text-fg-muted">
        {from}–{to} de {total}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} scroll={false} className={cn(btn, "text-fg hover:bg-white/5")} aria-label="Página anterior">
            <ChevronLeft className="h-4 w-4" />
          </Link>
        ) : (
          <span className={cn(btn, "opacity-40")} aria-hidden>
            <ChevronLeft className="h-4 w-4" />
          </span>
        )}
        <span className="tabular text-[13px] text-fg-muted">
          {page}/{pages}
        </span>
        {page < pages ? (
          <Link href={href(page + 1)} scroll={false} className={cn(btn, "text-fg hover:bg-white/5")} aria-label="Próxima página">
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <span className={cn(btn, "opacity-40")} aria-hidden>
            <ChevronRight className="h-4 w-4" />
          </span>
        )}
      </div>
    </nav>
  );
}
