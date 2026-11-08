/** Abas e ordenações da central de cobranças (compartilhado entre servidor e cliente). */
export const COLLECTION_TABS = [
  { value: "todas", label: "Todas" },
  { value: "hoje", label: "Cobrar hoje" },
  { value: "proximas", label: "Próximas" },
  { value: "atrasadas", label: "Atrasadas" },
  { value: "adiadas", label: "Adiadas" },
  { value: "pagas", label: "Pagas" },
  { value: "confirmar", label: "A confirmar" },
] as const;

export type CollectionTab = (typeof COLLECTION_TABS)[number]["value"];

export function parseCollectionTab(v: string | undefined): CollectionTab {
  return COLLECTION_TABS.some((t) => t.value === v) ? (v as CollectionTab) : "todas";
}

export const COLLECTION_SORTS = [
  { value: "valor", label: "Maior valor" },
  { value: "atraso", label: "Mais atraso" },
] as const;

/** "data" é o padrão (sem parâmetro na URL). */
export type CollectionSort = "data" | (typeof COLLECTION_SORTS)[number]["value"];

export function parseCollectionSort(v: string | undefined): CollectionSort {
  return v === "valor" || v === "atraso" ? v : "data";
}
