"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Loader2, MapPin, Package, Search, ShoppingBag, User, Plus, HandCoins, CalendarPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { globalSearchAction } from "@/features/shell/actions";
import type { SearchResult } from "@/types/database";

const ICONS: Record<string, typeof User> = { customer: User, sale: ShoppingBag, city: MapPin, product: Package };
const KIND_LABEL: Record<string, string> = { customer: "Cliente", sale: "Venda", city: "Cidade", product: "Produto" };

/** Busca global (clientes por nome/telefone, vendas por número, cidades, produtos) + atalhos rápidos. */
export function CommandPalette({ open, onClose, isOwner }: { open: boolean; onClose: () => void; isOwner: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [prevOpen, setPrevOpen] = useState(open);

  // Reinicia a busca sempre que a paleta abre (ajuste de estado durante o render, sem efeito).
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setQ("");
      setResults([]);
      setActive(0);
      setLoading(false);
    }
  }

  const shortcuts = [
    { label: "Ver cobranças de hoje", href: "/cobrancas?aba=hoje", icon: HandCoins },
    ...(isOwner
      ? [
          { label: "Cadastrar cliente", href: "/clientes/novo", icon: Plus },
          { label: "Registrar venda", href: "/vendas/nova", icon: ShoppingBag },
        ]
      : []),
    { label: "Agendar visita", href: "/agenda?nova=1", icon: CalendarPlus },
  ];

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    const term = q.trim();
    if (!term) return;
    // Resposta de um termo antigo (digitação rápida) não pode sobrescrever a do termo atual.
    let stale = false;
    const t = setTimeout(async () => {
      const r = await globalSearchAction(term);
      if (stale) return;
      setLoading(false);
      if (r.ok) {
        setResults(r.data);
        setActive(0);
      }
    }, 250);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [q]);

  const list = q.trim() ? results.map((r) => ({ label: r.title, sub: r.subtitle, href: r.link, kind: r.kind })) : shortcuts.map((s) => ({ ...s, sub: "", kind: "shortcut" }));

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, list.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    }
    if (e.key === "Enter" && list[active]) {
      e.preventDefault();
      go(list[active].href);
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 flex items-start justify-center px-3 pt-[8dvh] sm:pt-[12dvh]" style={{ zIndex: "var(--z-modal)" }}>
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Busca global"
            onKeyDown={onKeyDown}
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 420, damping: 34 } }}
            exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}
            className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-line-strong bg-bg-elevated shadow-pop"
          >
            <div className="flex items-center gap-3 border-b border-line px-4">
              {loading ? <Loader2 className="h-5 w-5 animate-spin text-fg-subtle" /> : <Search className="h-5 w-5 text-fg-subtle" />}
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => {
                  const value = e.target.value;
                  setQ(value);
                  if (value.trim()) setLoading(true);
                  else {
                    setResults([]);
                    setLoading(false);
                  }
                }}
                placeholder="Nome, telefone, nº da venda, cidade…"
                className="h-14 w-full bg-transparent text-base text-fg outline-none placeholder:text-fg-subtle"
                aria-label="Buscar"
                role="combobox"
                aria-expanded
                aria-controls="cmd-list"
                aria-activedescendant={list[active] ? `cmd-${active}` : undefined}
              />
              <kbd className="hidden rounded-md border border-line px-1.5 py-0.5 text-[11px] text-fg-subtle sm:inline">Esc</kbd>
            </div>
            <ul id="cmd-list" role="listbox" className="max-h-[60dvh] overflow-y-auto p-2">
              {!q.trim() && <li className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">Atalhos</li>}
              {list.map((item, i) => {
                const Icon = item.kind === "shortcut" ? (shortcuts.find((s) => s.href === item.href)?.icon ?? ArrowRight) : (ICONS[item.kind] ?? ArrowRight);
                return (
                  <li key={item.href + i} id={`cmd-${i}`} role="option" aria-selected={i === active}>
                    <button
                      type="button"
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(item.href)}
                      className={cn(
                        "flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors",
                        i === active ? "bg-white/[0.06]" : "hover:bg-white/[0.03]",
                      )}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-bronze-soft text-bronze">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-fg">{item.label}</span>
                        {item.sub && <span className="block truncate text-[12px] text-fg-muted">{item.sub}</span>}
                      </span>
                      {item.kind !== "shortcut" && <span className="hidden text-[11px] text-fg-subtle sm:inline">{KIND_LABEL[item.kind]}</span>}
                    </button>
                  </li>
                );
              })}
              {q.trim() && !loading && results.length === 0 && (
                <li className="px-3 py-8 text-center text-sm text-fg-muted">Nenhum resultado para “{q.trim()}”.</li>
              )}
            </ul>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
