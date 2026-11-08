"use client";

import { AlertTriangle, Inbox, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-lg", className)} aria-hidden />;
}

/** Skeleton genérico de página: cabeçalho + cards + lista */
export function PageSkeleton({ cards = 4, rows = 6 }: { cards?: number; rows?: number }) {
  return (
    <div className="space-y-5" role="status" aria-label="Carregando">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      {cards > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: cards }).map((_, i) => (
            <Skeleton key={i} className="h-[92px] rounded-2xl" />
          ))}
        </div>
      )}
      <div className="space-y-2 rounded-2xl border border-line bg-card p-4">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
      <span className="sr-only">Carregando…</span>
    </div>
  );
}

export function ListSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)} role="status" aria-label="Carregando">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14" />
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "px-4 py-8" : "px-6 py-14", className)}>
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-bronze-soft text-bronze">
        {icon ?? <Inbox className="h-5 w-5" />}
      </div>
      <p className="text-[15px] font-semibold text-fg">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-fg-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "Não foi possível carregar",
  description = "Verifique sua conexão e tente novamente.",
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div role="alert" className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-danger-soft text-danger-fg">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <p className="text-[15px] font-semibold text-fg">{title}</p>
      <p className="mt-1 max-w-sm text-[13px] text-fg-muted">{description}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          <RotateCw className="h-4 w-4" /> Tentar novamente
        </Button>
      )}
    </div>
  );
}
