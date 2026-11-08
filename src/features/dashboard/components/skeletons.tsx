import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/states";
import { cn } from "@/lib/utils";

export function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" role="status" aria-label="Carregando indicadores">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className={cn("h-[96px] rounded-2xl sm:h-[112px]", i === 0 && "bg-white/[0.09]")} />
      ))}
    </div>
  );
}

export function SectionSkeleton({ rows = 4, className, tall }: { rows?: number; className?: string; tall?: boolean }) {
  return (
    <Card className={cn("min-w-0 p-4 sm:p-5", className)} role="status" aria-label="Carregando">
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className={cn("shrink-0 rounded-xl", tall ? "h-11 w-11" : "h-9 w-9")} />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-3/5" />
              <Skeleton className="h-3 w-2/5" />
            </div>
            <Skeleton className="h-4 w-16 shrink-0" />
          </div>
        ))}
      </div>
    </Card>
  );
}

export function AttentionSkeleton() {
  return (
    <Card className="min-w-0 overflow-hidden border-bronze/25" role="status" aria-label="Carregando atenção hoje">
      <div className="flex items-center gap-2.5 border-b border-line px-4 py-4 sm:px-5">
        <Skeleton className="h-2.5 w-2.5 rounded-full" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="divide-y divide-line">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-3 px-4 py-4 sm:px-5">
            <Skeleton className="hidden h-10 w-10 shrink-0 rounded-xl xs:block" />
            <div className="min-w-0 flex-1 space-y-2.5">
              <div className="flex justify-between gap-3">
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-4 w-20" />
              </div>
              <div className="flex gap-1.5">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-28 rounded-full" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-9 w-9 rounded-xl" />
                <Skeleton className="h-9 w-9 rounded-xl" />
                <Skeleton className="ml-auto h-9 w-24 rounded-xl" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function ChartSkeleton() {
  return (
    <Card className="min-w-0 p-4 sm:p-5" role="status" aria-label="Carregando gráfico">
      <Skeleton className="mb-1.5 h-4 w-44" />
      <Skeleton className="mb-5 h-3 w-56" />
      <div className="mb-2 flex justify-between">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-5 w-20" />
      </div>
      <Skeleton className="mb-6 h-2.5 w-full rounded-full" />
      <div className="flex h-[200px] items-end gap-3 sm:h-[240px]">
        {[45, 70, 55, 85, 60, 75].map((h, i) => (
          <div key={i} className="flex flex-1 items-end justify-center gap-1">
            <div className="skeleton w-3 rounded-t-md sm:w-5" style={{ height: `${h}%` }} aria-hidden />
            <div className="skeleton w-3 rounded-t-md sm:w-5" style={{ height: `${h * 0.7}%` }} aria-hidden />
          </div>
        ))}
      </div>
    </Card>
  );
}

export function QuickActionsSkeleton() {
  return (
    <div>
      <Skeleton className="mb-2.5 h-4 w-28" />
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[76px] rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
