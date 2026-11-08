import { Skeleton } from "@/components/ui/states";

export default function Loading() {
  return (
    <div className="space-y-5" role="status" aria-label="Carregando clientes">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-11 w-full rounded-xl sm:w-36" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:max-w-xl">
        <Skeleton className="h-[92px] rounded-2xl" />
        <Skeleton className="h-[92px] rounded-2xl" />
      </div>
      <div className="space-y-2.5">
        <Skeleton className="h-11 rounded-xl" />
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-11 rounded-xl" />
          ))}
        </div>
      </div>
      <div className="space-y-2.5 md:hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[118px] rounded-2xl" />
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
