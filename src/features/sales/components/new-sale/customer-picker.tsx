"use client";

import { useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, MapPin, Phone, RotateCcw, Search, UserPlus, X } from "lucide-react";
import { Avatar, Money } from "@/components/ui/misc";
import { inputClasses } from "@/components/ui/field";
import { buttonClasses } from "@/components/ui/button";
import { formatPhone } from "@/lib/format";
import { fade } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { searchCustomersAction } from "../../actions";
import type { CustomerOption } from "../../queries";

const DEBOUNCE_MS = 250;

/** Mesma regra do servidor (searchCustomerOptions): 2+ caracteres com letras ou 3+ dígitos. */
function searchKey(raw: string): string | null {
  const q = raw.trim().replace(/\s+/g, " ");
  if (/\p{L}/u.test(q)) return q.length >= 2 ? q : null;
  return q.replace(/\D/g, "").length >= 3 ? q : null;
}

type SearchState = { key: string; results: CustomerOption[]; error: string | null };

/** Combobox de clientes (nome ou telefone) com busca no servidor e lista em linha — funciona bem no celular. */
export function CustomerPicker({
  hasCustomers,
  value,
  onChange,
  error,
}: {
  hasCustomers: boolean;
  value: CustomerOption | null;
  onChange: (c: CustomerOption | null) => void;
  error?: string;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [search, setSearch] = useState<SearchState | null>(null);
  const [retry, setRetry] = useState(0);

  const key = searchKey(query);

  useEffect(() => {
    if (!key) return;
    let alive = true;
    const timer = setTimeout(() => {
      searchCustomersAction(key)
        .then((r) => {
          if (!alive) return;
          setSearch(r.ok ? { key, results: r.data, error: null } : { key, results: [], error: r.error });
        })
        .catch(() => {
          if (alive) setSearch({ key, results: [], error: "Falha de conexão com o servidor. Verifique sua internet." });
        });
    }, DEBOUNCE_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [key, retry]);

  const settled = key !== null && search?.key === key;
  const loading = key !== null && !settled;
  const results = useMemo(() => (settled && search ? search.results : []), [settled, search]);
  const searchError = settled ? (search?.error ?? null) : null;

  function select(c: CustomerOption) {
    onChange(c);
    setQuery("");
    setActive(0);
    setSearch(null);
  }

  if (value) {
    return (
      <motion.div
        variants={fade}
        initial="hidden"
        animate="show"
        className="flex items-center gap-3 rounded-2xl border border-bronze/40 bg-bronze-soft p-3.5"
      >
        <Avatar name={value.full_name} className="h-11 w-11" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-fg">{value.full_name}</p>
          <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-fg-muted">
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">{value.city_name ?? "Sem cidade"}</span>
            </span>
            {(value.phone || value.whatsapp) && (
              <span className="tabular inline-flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" aria-hidden />
                {formatPhone(value.phone || value.whatsapp)}
              </span>
            )}
          </p>
          <p className="mt-1 text-[12px] text-fg-muted">
            Saldo atual:{" "}
            <Money value={value.balance} className={cn("font-semibold", value.balance > 0 ? "text-warning" : "text-success")} />
          </p>
        </div>
        <button type="button" onClick={() => onChange(null)} className={buttonClasses("ghost", "sm", "shrink-0")} aria-label="Trocar cliente">
          <X className="h-4 w-4" /> Trocar
        </button>
      </motion.div>
    );
  }

  const open = query.trim().length > 0;

  return (
    <div className="min-w-0">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
        <input
          id={id}
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && results[active] ? `${id}-opt-${results[active].id}` : undefined}
          aria-invalid={error ? true : undefined}
          aria-label="Buscar cliente por nome ou telefone"
          placeholder="Buscar cliente por nome ou telefone"
          autoComplete="off"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (!results.length) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(results.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              select(results[active] ?? results[0]);
            }
          }}
          className={inputClasses("pl-10 [&::-webkit-search-cancel-button]:hidden")}
        />
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-[12px] font-medium text-danger-fg">
          {error}
        </p>
      )}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div variants={fade} initial="hidden" animate="show" exit="exit" className="mt-2">
            {!key ? (
              <p className="rounded-2xl border border-dashed border-line-strong px-4 py-4 text-center text-[13px] text-fg-muted">
                Digite ao menos 2 letras do nome ou 3 dígitos do telefone.
              </p>
            ) : loading ? (
              <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 rounded-2xl border border-line bg-bg-elevated px-4 py-5 text-[13px] text-fg-muted">
                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden /> Buscando clientes…
              </div>
            ) : searchError ? (
              <div role="alert" className="rounded-2xl border border-danger/30 bg-danger-soft px-4 py-4 text-center">
                <p className="text-sm text-fg">{searchError}</p>
                <button type="button" onClick={() => setRetry((n) => n + 1)} className={buttonClasses("secondary", "sm", "mt-3")}>
                  <RotateCcw className="h-4 w-4" /> Tentar de novo
                </button>
              </div>
            ) : results.length > 0 ? (
              <ul id={listId} role="listbox" aria-label="Clientes encontrados" className="overflow-hidden rounded-2xl border border-line bg-bg-elevated">
                {results.map((c, i) => (
                  <li
                    key={c.id}
                    id={`${id}-opt-${c.id}`}
                    role="option"
                    aria-selected={i === active}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => select(c)}
                    className={cn(
                      "flex min-h-14 cursor-pointer items-center gap-3 border-b border-line px-3.5 py-2.5 last:border-b-0 transition-colors",
                      i === active ? "bg-white/[0.05]" : "hover:bg-white/[0.03]",
                    )}
                  >
                    <Avatar name={c.full_name} className="h-9 w-9 rounded-[10px] text-[12px]" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-fg">{c.full_name}</p>
                      <p className="truncate text-[12px] text-fg-muted">
                        {c.city_name ?? "Sem cidade"}
                        {(c.phone || c.whatsapp) && <span className="tabular"> · {formatPhone(c.phone || c.whatsapp)}</span>}
                      </p>
                    </div>
                    {c.balance > 0 && (
                      <span className="shrink-0 text-right">
                        <span className="block text-[11px] text-fg-subtle">Saldo</span>
                        <Money value={c.balance} className="text-[13px] font-medium text-warning" />
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div id={listId} role="listbox" aria-label="Clientes encontrados" className="rounded-2xl border border-dashed border-line-strong px-4 py-5 text-center">
                <p className="text-sm text-fg">Nenhum cliente encontrado para “{query.trim()}”.</p>
                <Link href="https://rp2.alfred511.top/hf/clientes/novo" className={buttonClasses("secondary", "sm", "mt-3")}>
                  <UserPlus className="h-4 w-4" /> Cadastrar cliente
                </Link>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      {!open && !hasCustomers && (
        <div className="mt-2 rounded-2xl border border-dashed border-line-strong px-4 py-5 text-center">
          <p className="text-sm text-fg">Nenhum cliente ativo cadastrado.</p>
          <Link href="https://rp2.alfred511.top/hf/clientes/novo" className={buttonClasses("secondary", "sm", "mt-3")}>
            <UserPlus className="h-4 w-4" /> Cadastrar cliente
          </Link>
        </div>
      )}
      {!open && hasCustomers && <p className="mt-1.5 text-[12px] text-fg-subtle">Digite parte do nome ou ao menos 3 dígitos do telefone.</p>}
    </div>
  );
}
