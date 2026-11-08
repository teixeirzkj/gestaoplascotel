import { Skeleton } from "@/components/ui/states";

/** Skeleton do formulário de cliente (novo/editar). */
export function FormSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-4" role="status" aria-label="Carregando formulário">
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      {[3, 4, 1].map((fields, i) => (
        <div key={i} className="space-y-4 rounded-2xl border border-line bg-card p-4 sm:p-5">
          <Skeleton className="h-5 w-40" />
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: fields }).map((_, j) => (
              <div key={j} className={j === 0 && fields !== 4 ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}>
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-11 rounded-xl" />
              </div>
            ))}
          </div>
        </div>
      ))}
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
