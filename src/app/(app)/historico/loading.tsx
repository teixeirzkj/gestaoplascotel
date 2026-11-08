import { Skeleton } from "@/components/ui/states";

export default function Loading() {
  return (
    <div role="status" aria-label="Carregando histórico">
      <div className="mb-6 space-y-2">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="mb-5 flex gap-2">
        <Skeleton className="h-11 flex-1 rounded-xl" />
        <Skeleton className="h-11 w-11 rounded-xl sm:w-28" />
      </div>
      {[4, 3].map((rows, g) => (
        <div key={g} className="mb-6">
          <div className="mb-3 flex gap-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
            {Array.from({ length: rows }).map((_, i) => (
              <div key={i} className="flex gap-3 px-4 py-4 sm:px-5">
                <Skeleton className="h-9 w-9 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-24 rounded-full" />
                    <Skeleton className="h-4 w-10" />
                  </div>
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
