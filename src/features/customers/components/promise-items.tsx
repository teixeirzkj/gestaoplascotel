import { Handshake } from "lucide-react";
import { StatusBadge } from "@/components/ui/badge";
import { Money } from "@/components/ui/misc";
import { MotionItem, MotionList } from "@/components/ui/motion-list";
import { PromiseActions } from "@/features/collections/components/promise-actions";
import { PROMISE_STATUS, methodLabel } from "@/lib/labels";
import { formatDate, formatDateTime } from "@/lib/format";
import type { PromiseView } from "@/types/database";

export function PromiseCard({ p, installmentLabel }: { p: PromiseView; installmentLabel?: string | null }) {
  const pending = p.status === "pending";
  return (
    <div className="rounded-xl border border-line bg-bg-elevated p-3.5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warning-soft text-warning">
          <Handshake className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <Money value={p.amount} className="text-[15px] font-semibold text-fg" />
            <StatusBadge status={p.effective_status} map={PROMISE_STATUS} />
          </div>
          <p className="mt-1 text-[12.5px] text-fg-muted">
            Prometido para <span className="tabular font-medium text-fg">{formatDate(p.due_date)}</span>
            {p.expected_method ? ` · ${methodLabel(p.expected_method)}` : ""}
            {installmentLabel ? ` · ${installmentLabel}` : ""}
          </p>
          {p.notes && <p className="mt-1.5 break-words text-[13px] text-fg">{p.notes}</p>}
          <p className="mt-1 text-[11.5px] text-fg-subtle">
            Registrada em {formatDate(p.promised_on)}
            {p.resolved_at ? ` · resolvida em ${formatDateTime(p.resolved_at)}` : ""}
          </p>
        </div>
      </div>
      {pending && (
        <div className="mt-3 border-t border-line pt-3">
          <PromiseActions promise={p} />
        </div>
      )}
    </div>
  );
}

export function PromiseList({ items, labels }: { items: PromiseView[]; labels?: Map<string, string> }) {
  return (
    <MotionList className="space-y-2">
      {items.map((p) => (
        <MotionItem key={p.id}>
          <PromiseCard p={p} installmentLabel={p.installment_id ? labels?.get(p.installment_id) : null} />
        </MotionItem>
      ))}
    </MotionList>
  );
}
