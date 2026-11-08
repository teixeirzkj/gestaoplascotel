import { Skeleton } from "@/components/ui/states";

/** Skeleton da central de cobranças: cabeçalho, abas, filtros, totais e lista (cards no celular, tabela no desktop). */
export default function Loading() {
  return (
    <div className="min-w-0" role="status" aria-label="Carregando cobranças">
      <div className="mb-5 space-y-2 sm:mb-6">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>

      <div className="mb-4 flex gap-2 overflow-hidden border-b border-line pb-2">
        {["w-16", "w-24", "w-20", "w-[84px]", "w-[72px]", "w-14", "w-[92px]"].map((w, i) => (
          <Skeleton key={i} className={`h-7 shrink-0 rounded-md ${w}`} />
        ))}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-[1fr_200px_210px]">
        <Skeleton className="col-span-2 h-11 rounded-xl md:col-span-1" />
        <Skeleton className="h-11 rounded-xl" />
        <Skeleton className="h-11 rounded-xl" />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <Skeleton className="h-[92px] rounded-2xl" />
        <Skeleton className="h-[92px] rounded-2xl" />
      </div>

      {/* Celular: cards */}
      <div className="space-y-3 md:hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-line bg-card p-4">
            <div className="flex items-start gap-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-11 w-11 rounded-xl" />
            </div>
            <div className="mt-4 flex items-end justify-between">
              <Skeleton className="h-7 w-28" />
              <Skeleton className="h-5 w-20" />
            </div>
            <Skeleton className="mt-3 h-14 rounded-xl" />
            <div className="mt-4 flex gap-2 border-t border-line pt-3">
              <Skeleton className="h-11 flex-1 rounded-xl" />
              <Skeleton className="h-11 w-11 rounded-xl" />
              <Skeleton className="h-11 w-11 rounded-xl" />
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: tabela */}
      <div className="hidden rounded-2xl border border-line bg-card md:block">
        <div className="flex gap-6 border-b border-line px-4 py-3">
          {["w-[120px]", "w-14", "w-20", "w-[70px]", "w-[90px]"].map((w, i) => (
            <Skeleton key={i} className={`h-3 ${w}`} />
          ))}
        </div>
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-center gap-6 border-b border-line px-4 py-3 last:border-0">
            <div className="w-[200px] space-y-1.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="ml-auto h-4 w-20" />
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-11 w-44 rounded-xl" />
          </div>
        ))}
      </div>
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
