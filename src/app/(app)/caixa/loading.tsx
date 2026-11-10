import { Skeleton } from "@/components/ui/states";

export default function Loading() {
  return (
    <div className="space-y-5" role="status" aria-label="Carregando caixa">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <Skeleton className="h-11 w-full rounded-xl xs:w-44" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-11 w-11 rounded-xl" />
        <Skeleton className="h-11 flex-1 rounded-xl sm:w-[260px] sm:flex-none" />
        <Skeleton className="h-11 w-11 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <Skeleton className="h-[148px] rounded-2xl" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[92px] rounded-2xl" />
            ))}
          </div>
          <div className="space-y-2 rounded-2xl border border-line bg-card p-4">
            <Skeleton className="mb-3 h-5 w-48" />
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        </div>
        <div className="space-y-5">
          <Skeleton className="h-[150px] rounded-2xl" />
          <Skeleton className="h-[160px] rounded-2xl" />
          <Skeleton className="h-[250px] rounded-2xl" />
        </div>
      </div>
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
