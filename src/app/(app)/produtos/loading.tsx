import { Skeleton } from "@/components/ui/states";

export default function Loading() {
  return (
    <div className="space-y-5" role="status" aria-label="Carregando produtos">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-4 w-56 max-w-full" />
        </div>
        <Skeleton className="hidden h-11 w-36 rounded-xl sm:block" />
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_200px_160px]">
        <Skeleton className="h-11 rounded-xl" />
        <div className="grid grid-cols-2 gap-2 sm:contents">
          <Skeleton className="h-11 rounded-xl" />
          <Skeleton className="h-11 rounded-xl" />
        </div>
      </div>
      <div className="space-y-2 md:hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[76px] rounded-2xl" />
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
