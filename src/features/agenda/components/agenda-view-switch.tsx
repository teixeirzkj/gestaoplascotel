"use client";

import { CalendarDays, History, List, Route } from "lucide-react";
import { Segmented } from "@/components/ui/tabs";
import { useUrlParams } from "@/components/ui/url-controls";
import type { AgendaView } from "../utils";

const OPTIONS: { value: AgendaView; label: React.ReactNode }[] = [
  { value: "lista", label: <span className="inline-flex items-center gap-1.5"><List className="hidden h-4 w-4 sm:block" aria-hidden />Lista</span> },
  { value: "calendario", label: <span className="inline-flex items-center gap-1.5"><CalendarDays className="hidden h-4 w-4 sm:block" aria-hidden />Calendário</span> },
  { value: "roteiro", label: <span className="inline-flex items-center gap-1.5"><Route className="hidden h-4 w-4 sm:block" aria-hidden />Roteiro</span> },
  { value: "historico", label: <span className="inline-flex items-center gap-1.5"><History className="hidden h-4 w-4 sm:block" aria-hidden />Histórico</span> },
];

/** Troca de visão (?visao=) limpando os parâmetros específicos de cada visão. */
export function AgendaViewSwitch({ value }: { value: AgendaView }) {
  const { set, pending } = useUrlParams();
  return (
    <Segmented
      value={value}
      options={OPTIONS}
      className={pending ? "opacity-80" : undefined}
      onChange={(v) => set({ visao: v === "lista" ? null : v, mes: null, data: null, local: null, situacao: null, page: null }, { resetPage: true })}
    />
  );
}
