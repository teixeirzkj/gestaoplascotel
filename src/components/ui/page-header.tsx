import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  back,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
  className?: string;
}) {
  return (
    <header className={cn("mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {back && (
          <Link
            href={back.href}
            className="-ml-1 mb-0.5 inline-flex h-11 items-center sm:mb-1.5 sm:h-8 gap-1 rounded-lg pr-2 text-[13px] font-medium text-fg-muted transition-colors hover:text-fg"
          >
            <ChevronLeft className="h-4 w-4" /> {back.label}
          </Link>
        )}
        <h1 className="text-[22px] font-semibold leading-tight tracking-tight text-fg sm:text-[26px]">{title}</h1>
        {description && <p className="mt-1 text-[13px] text-fg-muted sm:text-sm">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Título de seção dentro de páginas */
export function SectionTitle({ children, action, className }: { children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-3 flex items-center justify-between gap-3", className)}>
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-fg-muted">{children}</h2>
      {action}
    </div>
  );
}
