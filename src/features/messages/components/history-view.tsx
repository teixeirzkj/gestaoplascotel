import Link from "next/link";
import { History, MessageCircle, SkipForward, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { MotionList } from "@/components/ui/motion-list";
import { EmptyState } from "@/components/ui/states";
import { formatBRL, formatDateTime } from "@/lib/format";
import { KIND_META } from "../config";
import type { MessageHistoryRow } from "../queries";

type Stats = { sent7: number; sent30: number; skipped30: number; paidAfter: number; paidAfterRate: number | null };

export function HistoryView({ rows, stats }: { rows: MessageHistoryRow[]; stats: Stats }) {
  return (
    <div className="space-y-5">
      <MotionList className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Enviadas (7 dias)" value={stats.sent7} icon={<MessageCircle className="h-4 w-4" />} />
        <StatCard label="Enviadas (30 dias)" value={stats.sent30} icon={<History className="h-4 w-4" />} />
        <StatCard
          tone="success"
          label="Pagaram em até 7 dias"
          value={stats.paidAfterRate === null ? "—" : `${Math.round(stats.paidAfterRate * 100)}%`}
          hint={`${stats.paidAfter} cobrança(s) com pagamento depois da mensagem`}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard label="Puladas (30 dias)" value={stats.skipped30} icon={<SkipForward className="h-4 w-4" />} />
      </MotionList>

      <Card>
        {rows.length === 0 ? (
          <EmptyState icon={<History className="h-5 w-5" />} title="Nenhuma mensagem nos últimos 30 dias" description="Quando a equipe enviar mensagens pela fila, elas aparecem aqui." />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((r) => {
              const meta = KIND_META[r.kind];
              return (
                <li key={r.group_id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 sm:flex-nowrap">
                  <div className="min-w-0 flex-1">
                    <Link href={`/clientes/${r.customer_id}`} className="block truncate text-sm font-medium text-fg hover:text-bronze">
                      {r.customer_name}
                    </Link>
                    <p className="truncate text-[12px] text-fg-muted">
                      {formatDateTime(r.created_at)}
                      {r.created_by_name ? ` · ${r.created_by_name}` : ""}
                      {r.status === "skipped" && r.skip_reason ? ` · ${r.skip_reason}` : ""}
                    </p>
                  </div>
                  <Badge tone={meta.tone}>{meta.short}</Badge>
                  {r.status === "skipped" ? <Badge tone="muted">Pulada</Badge> : <Badge tone="success">Enviada</Badge>}
                  {r.amount !== null && <span className="money w-24 text-right text-sm text-fg">{formatBRL(r.amount)}</span>}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
