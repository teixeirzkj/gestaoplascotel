"use client";

import { FilterSelect, SearchInput, useUrlParams } from "@/components/ui/url-controls";
import { Segmented } from "@/components/ui/tabs";
import { CITY_SORTS } from "../schemas";

/** Busca, ordenação e filtro ativas/arquivadas (tudo na URL). */
export function CitiesToolbar() {
  const { params, set } = useUrlParams();
  const archived = params.get("arquivadas") === "1" ? "archived" : "active";
  return (
    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
      <SearchInput placeholder="Buscar cidade" className="md:max-w-xs md:flex-1" />
      <div className="flex min-w-0 items-center gap-2 md:ml-auto">
        <FilterSelect
          param="ordem"
          label="Ordenar cidades"
          placeholder="Maior pendente"
          options={CITY_SORTS.filter((s) => s.value !== "pendente").map((s) => ({ value: s.value, label: s.label }))}
          className="min-w-0 flex-1 md:w-52 md:flex-none"
        />
        <Segmented
          className="mx-0 shrink-0 px-0"
          value={archived}
          onChange={(v) => set({ arquivadas: v === "archived" ? "1" : null })}
          options={[
            { value: "active", label: "Ativas" },
            { value: "archived", label: "Arquivadas" },
          ]}
        />
      </div>
    </div>
  );
}
