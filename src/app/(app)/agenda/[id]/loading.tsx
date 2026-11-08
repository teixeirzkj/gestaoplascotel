import { Skeleton } from "@/components/ui/states";

export default function Loading() {
  return (
    <div role="status" aria-label="Carregando visita">
      <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-11 flex-1 rounded-xl sm:w-52" />
          <Skeleton className="h-11 w-28 rounded-xl" />
        </div>
      </div>
      <div className="mb-5 grid gap-4 rounded-2xl border border-line bg-card p-4 sm:p-5 md:grid-cols-2">
        <div className="space-y-2.5">
          <Skeleton className="h-6 w-64 max-w-full" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-full" />
        </div>
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <div className="mb-3 flex items-center justify-between">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-40 rounded-[10px]" />
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-2xl border border-line bg-card p-4 sm:p-5">
            <div className="flex gap-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-5 w-44" />
                <Skeleton className="h-4 w-60 max-w-full" />
              </div>
            </div>
            <Skeleton className="h-14 rounded-xl" />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {Array.from({ length: 5 }).map((__, j) => (
                <Skeleton key={j} className="h-12 rounded-xl" />
              ))}
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
