import { Skeleton } from "@/components/ui/states";

export default function Loading() {
  return (
    <div role="status" aria-label="Carregando agenda">
      <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-11 w-full rounded-xl sm:w-36" />
      </div>
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Skeleton className="h-11 w-full max-w-[420px] rounded-xl" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          {Array.from({ length: 2 }).map((_, g) => (
            <div key={g}>
              <div className="mb-3 flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-xl" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-3 w-28" />
                </div>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <Skeleton className="h-[120px] rounded-2xl" />
                <Skeleton className="h-[120px] rounded-2xl" />
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-2 rounded-2xl border border-line bg-card p-4">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-full" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      </div>
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
