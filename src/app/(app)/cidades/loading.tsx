import { Skeleton } from "@/components/ui/states";

export default function Loading() {
  return (
    <div role="status" aria-label="Carregando cidades">
      <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <Skeleton className="h-11 w-36 rounded-xl" />
      </div>
      <div className="mb-4 flex flex-col gap-3 md:flex-row">
        <Skeleton className="h-11 w-full rounded-xl md:max-w-xs" />
        <div className="flex gap-2 md:ml-auto">
          <Skeleton className="h-11 flex-1 rounded-xl md:w-52" />
          <Skeleton className="h-11 w-44 rounded-xl" />
        </div>
      </div>
      <div className="grid gap-2.5 md:hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[196px] rounded-2xl" />
        ))}
      </div>
      <div className="hidden space-y-2 rounded-2xl border border-line bg-card p-4 md:block">
        <Skeleton className="h-8" />
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
