"use client";

import Link from "next/link";
import { ChevronRight, Clock, StickyNote } from "lucide-react";
import { StatusBadge } from "@/components/ui/badge";
import { VISIT_STATUS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { formatVisitTime } from "../utils";
import type { VisitSummary } from "../types";
import { VisitProgress } from "./visit-progress";

/** Card de visita (lista agrupada por data, calendário, histórico no celular). */
export function VisitCard({ visit, className, showStatus = true }: { visit: VisitSummary; className?: string; showStatus?: boolean }) {
  const time = formatVisitTime(visit.visitTime);
  return (
    <Link
      href={`/agenda/${visit.id}`}
      className={cn(
        "group block rounded-2xl border border-line bg-card p-4 shadow-card transition-[transform,border-color] hover:border-line-strong active:scale-[0.98]",
        visit.status === "cancelled" && "opacity-70",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="truncate text-[15px] font-semibold tracking-tight text-fg">
              {visit.cityName}
              <span className="ml-1 text-[12px] font-medium text-fg-subtle">{visit.cityState}</span>
            </p>
            {showStatus && <StatusBadge status={visit.status} map={VISIT_STATUS} />}
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-fg-muted">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            {time ?? "Sem horário definido"}
          </p>
        </div>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-fg-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
      </div>
      {visit.notes && (
        <p className="mt-2 flex items-start gap-1.5 text-[12.5px] text-fg-muted">
          <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fg-subtle" aria-hidden />
          <span className="line-clamp-2">{visit.notes}</span>
        </p>
      )}
      <div className="mt-3">
        {visit.total > 0 ? (
          <VisitProgress attended={visit.attended} total={visit.total} size="sm" />
        ) : (
          <p className="text-[12px] text-fg-subtle">Nenhum cliente selecionado ainda</p>
        )}
      </div>
    </Link>
  );
}
