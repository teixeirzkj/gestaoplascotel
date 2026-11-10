import { Skeleton } from "@/components/ui/states";

export default function Loading() {
  return (
    <div role="status" aria-label="Carregando configurações">
      <div className="mb-6 space-y-2">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="mb-5 flex gap-3 border-b border-line pb-3">
        {["w-36", "w-20", "w-24", "w-40"].map((w) => (
          <Skeleton key={w} className={`h-5 max-w-[24%] shrink-0 ${w}`} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {[4, 3].map((fields, c) => (
          <div key={c} className="rounded-2xl border border-line bg-card p-4 sm:p-5">
            <Skeleton className="mb-1.5 h-4 w-32" />
            <Skeleton className="mb-5 h-3 w-60 max-w-full" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {Array.from({ length: fields }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-11 rounded-xl" />
                </div>
              ))}
            </div>
            <div className="mt-5 flex justify-end border-t border-line pt-4">
              <Skeleton className="h-11 w-28 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
