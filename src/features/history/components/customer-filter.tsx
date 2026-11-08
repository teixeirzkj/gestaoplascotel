"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Search, UserRound, X } from "lucide-react";
import { inputClasses } from "@/components/ui/field";
import { useUrlParams } from "@/components/ui/url-controls";
import { fade } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { searchCustomerOptions } from "../actions";

type Option = { value: string; label: string };

const MIN_CHARS = 2;
const DEBOUNCE_MS = 300;

/**
 * Filtro de cliente do histórico: combobox com busca no servidor (não carrega a lista inteira).
 * O valor fica em ?cliente=; `selected` traz o nome do cliente já escolhido (buscado pela página).
 */
export function CustomerFilter({ selected }: { selected: Option | null }) {
  const id = useId();
  const listId = `${id}-list`;
  const { params, set } = useUrlParams();
  const value = params.get("cliente");

  // Nome escolhido agora, até a página devolver o `selected` atualizado.
  const [picked, setPicked] = useState<Option | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const requestId = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const term = query.trim();

  useEffect(() => {
    if (term.length < MIN_CHARS) return;
    const current = ++requestId.current;
    const t = setTimeout(async () => {
      let next: Option[] = [];
      let message: string | null = null;
      try {
        const r = await searchCustomerOptions(term);
        if (r.ok) next = r.data;
        else message = r.error;
      } catch {
        message = "Falha de conexão. Tente novamente.";
      }
      if (current !== requestId.current) return; // resposta de uma busca antiga
      setResults(next);
      setError(message);
      setLoading(false);
      setActive(0);
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [term]);

  const label = value ? (picked?.value === value ? picked.label : selected?.value === value ? selected.label : null) : null;

  function choose(o: Option) {
    setPicked(o);
    setQuery("");
    setResults([]);
    setOpen(false);
    set({ cliente: o.value });
  }

  function clear() {
    setPicked(null);
    set({ cliente: null });
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  if (value) {
    return (
      <div className="flex h-11 min-w-0 items-center gap-2 rounded-xl border border-bronze/40 bg-bronze-soft pl-3.5">
        <UserRound className="h-4 w-4 shrink-0 text-bronze" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{label ?? "Cliente selecionado"}</span>
        <button
          type="button"
          onClick={clear}
          aria-label={`Remover filtro de cliente${label ? `: ${label}` : ""}`}
          className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-fg-muted transition-colors hover:text-fg"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    );
  }

  const showList = open && term.length >= MIN_CHARS;

  return (
    <div className="relative min-w-0">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
      <input
        ref={inputRef}
        id={id}
        type="search"
        role="combobox"
        aria-label="Cliente"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && results[active] ? `${id}-opt-${results[active].value}` : undefined}
        placeholder="Todos os clientes"
        autoComplete="off"
        value={query}
        onChange={(e) => {
          const next = e.target.value;
          setQuery(next);
          setOpen(true);
          if (next.trim() === term) return;
          // "Buscando…" já durante o debounce; a lista antiga some para não ser escolhida por engano.
          setResults([]);
          setError(null);
          setLoading(next.trim().length >= MIN_CHARS);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            return;
          }
          if (!results.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(results.length - 1, a + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(0, a - 1));
          } else if (e.key === "Enter" && showList) {
            e.preventDefault();
            choose(results[active] ?? results[0]);
          }
        }}
        className={inputClasses("pl-10 pr-10 [&::-webkit-search-cancel-button]:hidden")}
      />
      {loading && <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-fg-subtle" aria-hidden />}
      {!showList && open && term.length > 0 && term.length < MIN_CHARS && (
        <p className="mt-1.5 text-[12px] text-fg-subtle">Digite ao menos {MIN_CHARS} letras do nome.</p>
      )}

      <AnimatePresence initial={false}>
        {showList && (
          <motion.div
            variants={fade}
            initial="hidden"
            animate="show"
            exit="exit"
            className="absolute inset-x-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl border border-line-strong bg-bg-elevated shadow-pop"
          >
            <ul id={listId} role="listbox" aria-label="Clientes encontrados" className="max-h-72 overflow-y-auto overscroll-contain">
              {results.map((o, i) => (
                <li
                  key={o.value}
                  id={`${id}-opt-${o.value}`}
                  role="option"
                  aria-selected={i === active}
                  // mousedown + preventDefault: escolhe antes do blur fechar a lista
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(o);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center border-b border-line px-3.5 py-2 text-sm text-fg last:border-b-0 transition-colors",
                    i === active ? "bg-white/[0.05]" : "hover:bg-white/[0.03]",
                  )}
                >
                  <span className="truncate">{o.label}</span>
                </li>
              ))}
            </ul>
            {results.length === 0 && (
              <p className="px-3.5 py-3 text-[13px] text-fg-muted" role="status">
                {error ?? (loading ? "Buscando…" : `Nenhum cliente encontrado para “${term}”.`)}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
