"use client";

import { useRouter } from "next/navigation";
import { FilterSelect, SearchInput } from "@/components/ui/url-controls";
import { ErrorState } from "@/components/ui/states";
import { cn } from "@/lib/utils";
import { COLLECTION_SORTS, type CollectionTab } from "../tabs";

/** Busca (?q=), cidade (?cidade=) e ordenação (?ordem=) sincronizadas com a URL. */
export function CollectionsFilters({ cities, tab }: { cities: { value: string; label: string }[]; tab: CollectionTab }) {
  const showSort = tab !== "confirmar";
  return (
    <div className={cn("grid grid-cols-2 gap-2 sm:gap-3", showSort ? "md:grid-cols-[1fr_200px_210px]" : "md:grid-cols-[1fr_220px]")}>
      <SearchInput placeholder="Buscar cliente ou telefone" className="col-span-2 md:col-span-1" />
      {/* Textos curtos: a 360px cada select tem ~150px; o nome completo fica no aria-label. */}
      <FilterSelect param="cidade" label="Filtrar por cidade (todas as cidades)" placeholder="Cidade" options={cities} className={cn(!showSort && "col-span-2 md:col-span-1")} />
      {showSort && (
        <FilterSelect
          param="ordem"
          label={tab === "pagas" ? "Ordenar (padrão: pagas mais recentes)" : "Ordenar (padrão: data de cobrança)"}
          placeholder={tab === "pagas" ? "Mais recentes" : "Vencimento"}
          options={COLLECTION_SORTS.filter((s) => !(tab === "pagas" && s.value === "atraso")).map((s) => ({ value: s.value, label: s.label }))}
        />
      )}
    </div>
  );
}

/** Erro de carregamento com "tentar novamente" (refaz a requisição do servidor). */
export function CollectionsError({ message }: { message: string }) {
  const router = useRouter();
  return <ErrorState title="Não foi possível carregar as cobranças" description={message} onRetry={() => router.refresh()} />;
}
