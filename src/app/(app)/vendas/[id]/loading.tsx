import { Skeleton } from "@/components/ui/states";

export default function Loading() {
  return (
    <div role="status" aria-label="Carregando venda">
      <div className="mb-5 space-y-2">
        <Skeleton className="h-4 w-16" />
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="space-y-5">
          <div className="rounded-2xl border border-line bg-card">
            <div className="flex items-center gap-3 p-4 sm:p-5">
              <Skeleton className="h-11 w-11 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-14" />
                <Skeleton className="h-5 w-48 max-w-full" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-line p-4 sm:grid-cols-3 sm:p-5">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <div className="space-y-2 rounded-2xl border border-line bg-card p-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-3 rounded-2xl border border-line bg-card p-4 sm:p-5">
          <Skeleton className="h-28 rounded-2xl" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-7" />
          ))}
        </div>
      </div>

      <div className="mt-7 space-y-2">
        <Skeleton className="h-4 w-28" />
        <div className="space-y-2 md:hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
        <div className="hidden space-y-1 rounded-2xl border border-line bg-card p-4 md:block">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      </div>
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
