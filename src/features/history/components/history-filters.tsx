"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { FilterSelect, SearchInput, useUrlParams } from "@/components/ui/url-controls";
import { cn } from "@/lib/utils";
import { ease } from "@/lib/motion";
import { ACTIVITY_GROUP_OPTIONS } from "../constants";
import { CustomerFilter } from "./customer-filter";

type Option = { value: string; label: string };

const FILTER_KEYS = ["tipo", "usuario", "cliente", "de", "ate"] as const;

export function HistoryFilters({ users, selectedCustomer }: { users: Option[]; selectedCustomer: Option | null }) {
  const { params, set } = useUrlParams();
  const active = FILTER_KEYS.filter((k) => params.get(k)).length;
  const [open, setOpen] = useState(active > 0);
  const de = params.get("de") ?? "";
  const ate = params.get("ate") ?? "";

  return (
    <div className="mb-4 space-y-3">
      <div className="flex gap-2">
        <SearchInput placeholder="Buscar no resumo (ex.: estorno, venda #12)" className="flex-1" />
        <Button
          variant={open || active ? "secondary" : "outline"}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="history-filters"
          className="shrink-0"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Filtros</span>
          {active > 0 && (
            <span className="tabular rounded-full bg-bronze/20 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-bronze">{active}</span>
          )}
        </Button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id="history-filters"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.2, ease: ease.out } }}
            exit={{ opacity: 0, y: -4, transition: { duration: 0.13, ease: ease.in } }}
            className="rounded-2xl border border-line bg-bg-elevated p-3 sm:p-4"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <FilterBox label="Tipo de operação">
                <FilterSelect param="tipo" label="Tipo de operação" placeholder="Todos os tipos" options={ACTIVITY_GROUP_OPTIONS} />
              </FilterBox>
              <FilterBox label="Usuário">
                <FilterSelect param="usuario" label="Usuário" placeholder="Todos os usuários" options={users} />
              </FilterBox>
              <FilterBox label="Cliente">
                <CustomerFilter selected={selectedCustomer} />
              </FilterBox>
              <div className="grid grid-cols-2 gap-3 sm:col-span-2 lg:col-span-2">
                <Field label="De">
                  <Input type="date" value={de} max={ate || undefined} onChange={(e) => set({ de: e.target.value || null })} />
                </Field>
                <Field label="Até">
                  <Input type="date" value={ate} min={de || undefined} onChange={(e) => set({ ate: e.target.value || null })} />
                </Field>
              </div>
            </div>
            <div className={cn("mt-3 flex justify-end", !active && "hidden")}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => set({ tipo: null, usuario: null, cliente: null, de: null, ate: null })}
              >
                <X className="h-4 w-4" aria-hidden /> Limpar filtros
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FilterBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[13px] font-medium text-fg-muted" aria-hidden>
        {label}
      </span>
      {children}
    </div>
  );
}
