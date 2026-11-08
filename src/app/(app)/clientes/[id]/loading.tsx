import { Skeleton } from "@/components/ui/states";

export default function Loading() {
  return (
    <div className="space-y-4 sm:space-y-5" role="status" aria-label="Carregando ficha do cliente">
      <Skeleton className="h-6 w-24" />
      <div className="rounded-2xl border border-line bg-card p-4 sm:p-5">
        <div className="flex items-start gap-3.5">
          <Skeleton className="h-14 w-14 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-56 max-w-full" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <Skeleton className="h-6 w-24 rounded-full" />
          <div className="flex gap-2 sm:hidden">
            <Skeleton className="h-11 w-11 rounded-xl" />
            <Skeleton className="h-11 w-11 rounded-xl" />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-4 sm:flex">
          <Skeleton className="col-span-3 h-11 rounded-xl sm:w-40" />
          <Skeleton className="h-11 rounded-xl sm:w-32" />
          <Skeleton className="h-11 rounded-xl sm:w-32" />
          <Skeleton className="h-11 rounded-xl sm:w-28" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[92px] rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-[74px] rounded-2xl" />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <div className="flex gap-2 overflow-hidden border-b border-line pb-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-24 shrink-0" />
            ))}
          </div>
          <div className="space-y-2 rounded-2xl border border-line bg-card p-4">
            <Skeleton className="h-5 w-40" />
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[132px] rounded-xl" />
            ))}
          </div>
        </div>
        <Skeleton className="h-[380px] rounded-2xl" />
      </div>
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
