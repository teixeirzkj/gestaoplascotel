import { Skeleton } from "@/components/ui/states";
import { MonthlyChartSkeleton } from "@/features/reports/components/monthly-chart";
import { CardSkeleton, SummarySkeleton } from "@/features/reports/components/sections";

export default function Loading() {
  return (
    <div className="space-y-5" role="status" aria-label="Carregando relatórios">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-60 max-w-full" />
        </div>
        <Skeleton className="h-11 w-32 rounded-xl" />
      </div>
      <Skeleton className="h-11 w-full max-w-[560px] rounded-xl" />
      <SummarySkeleton />
      <MonthlyChartSkeleton />
      <CardSkeleton label="Carregando cidades" height={300} />
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
