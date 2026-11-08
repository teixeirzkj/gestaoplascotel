import { Skeleton } from "@/components/ui/states";

export default function Loading() {
  return (
    <div role="status" aria-label="Carregando formulário de venda">
      <div className="mb-5 space-y-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>

      {/* Celular: stepper + etapa */}
      <div className="lg:hidden">
        <div className="mb-6 grid grid-cols-4 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <Skeleton className="h-9 w-9 rounded-full" />
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
        <Skeleton className="mb-2 h-6 w-28" />
        <Skeleton className="mb-5 h-4 w-48" />
        <Skeleton className="mb-3 h-11 rounded-xl" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-11 rounded-xl" />
          <Skeleton className="h-11 rounded-xl" />
        </div>
      </div>

      {/* Desktop: formulário + resumo */}
      <div className="hidden grid-cols-[minmax(0,1fr)_minmax(320px,380px)] items-start gap-6 lg:grid">
        <div className="space-y-5">
          {[180, 260, 300].map((h) => (
            <div key={h} className="space-y-3 rounded-2xl border border-line bg-card p-5">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-56" />
              <div style={{ height: h - 90 }} className="skeleton rounded-xl" aria-hidden />
            </div>
          ))}
        </div>
        <div className="space-y-3">
          <div className="space-y-3 rounded-2xl border border-line bg-card p-5">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-20" />
          </div>
          <Skeleton className="h-12 rounded-xl" />
        </div>
      </div>
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
