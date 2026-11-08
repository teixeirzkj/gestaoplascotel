import { Skeleton } from "@/components/ui/states";

export default function Loading() {
  return (
    <div className="space-y-4" role="status" aria-label="Carregando vendas">
      <div className="flex items-end justify-between gap-3 pb-1">
        <div className="space-y-2">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <Skeleton className="hidden h-11 w-36 rounded-xl sm:block" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Skeleton className="h-[92px] rounded-2xl" />
        <Skeleton className="h-[92px] rounded-2xl" />
        <Skeleton className="col-span-2 h-[92px] rounded-2xl lg:col-span-1" />
      </div>
      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_170px_190px_170px]">
        <Skeleton className="h-11 rounded-xl" />
        <div className="grid grid-cols-2 gap-2 md:contents">
          <Skeleton className="h-11 rounded-xl" />
          <Skeleton className="h-11 rounded-xl" />
          <Skeleton className="col-span-2 h-11 rounded-xl md:col-span-1" />
        </div>
      </div>
      <div className="space-y-2 md:hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[150px] rounded-2xl" />
        ))}
      </div>
      <div className="hidden space-y-1 rounded-2xl border border-line bg-card p-4 md:block">
        <Skeleton className="h-8" />
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
