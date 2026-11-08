"use client";

import { useState } from "react";
import { Archive, X } from "lucide-react";
import { FilterSelect, SearchInput, useUrlParams } from "@/components/ui/url-controls";
import { CUSTOMER_STATUS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { CUSTOMER_SORTS, FINANCIAL_STATUSES } from "../schemas";
import type { CityOption } from "../types";

const STATUS_OPTIONS = FINANCIAL_STATUSES.map((s) => ({ value: s, label: CUSTOMER_STATUS[s].label }));
const SORT_OPTIONS = CUSTOMER_SORTS.filter((s) => s.value !== "nome").map((s) => ({ value: s.value, label: s.label }));

export function CustomerFilters({ cities }: { cities: CityOption[] }) {
  const { params, set } = useUrlParams();
  const [searchKey, setSearchKey] = useState(0);
  const archived = params.get("arquivados") === "1";
  const hasFilters = ["q", "cidade", "situacao", "ordem", "arquivados"].some((k) => params.get(k));

  return (
    <div className="space-y-2.5">
      <SearchInput key={searchKey} placeholder="Buscar por nome ou telefone" />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
        <FilterSelect
          param="cidade"
          label="Filtrar por cidade"
          placeholder="Todas as cidades"
          options={cities.map((c) => ({ value: c.id, label: `${c.name}/${c.state}` }))}
        />
        <FilterSelect param="situacao" label="Filtrar por situação" placeholder="Todas as situações" options={STATUS_OPTIONS} />
        <FilterSelect param="ordem" label="Ordenar por" placeholder="Nome (A–Z)" options={SORT_OPTIONS} />
        <button
          type="button"
          aria-pressed={archived}
          onClick={() => set({ arquivados: archived ? null : "1" })}
          className={cn(
            "inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3.5 text-[13px] font-medium transition-colors",
            archived ? "border-bronze/50 bg-bronze-soft text-bronze" : "border-line-strong bg-bg-elevated text-fg-muted hover:text-fg",
          )}
        >
          <Archive className="h-4 w-4" aria-hidden />
          {archived ? "Incluindo arquivados" : "Mostrar arquivados"}
        </button>
      </div>
      {hasFilters && (
        <button
          type="button"
          onClick={() => {
            setSearchKey((k) => k + 1);
            set({ q: null, cidade: null, situacao: null, ordem: null, arquivados: null });
          }}
          className="-ml-1 inline-flex h-9 cursor-pointer items-center gap-1 rounded-lg px-1 text-[13px] font-medium text-fg-muted transition-colors hover:text-fg"
        >
          <X className="h-3.5 w-3.5" aria-hidden /> Limpar filtros
        </button>
      )}
    </div>
  );
}
