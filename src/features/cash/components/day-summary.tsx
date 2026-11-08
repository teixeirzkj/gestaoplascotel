import { Banknote, CircleDollarSign, Landmark, QrCode, Users } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { MotionList } from "@/components/ui/motion-list";
import { Avatar } from "@/components/ui/misc";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CashDaySummary } from "@/types/database";

function Signed({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("money font-semibold", value < 0 && "text-danger", className)}>
      {value < 0 ? "−" : ""}
      {formatBRL(Math.abs(value))}
    </span>
  );
}

/** Destaque do total do dia + grade 2x2 por forma de pagamento. */
export function DaySummary({ summary, isToday }: { summary: CashDaySummary; isToday: boolean }) {
  const methods = [
    { label: "Pix", value: summary.pix, icon: <QrCode className="h-4 w-4" /> },
    { label: "Dinheiro", value: summary.cash, icon: <Banknote className="h-4 w-4" /> },
    { label: "Transferência", value: summary.transfer, icon: <Landmark className="h-4 w-4" /> },
    { label: "Outros", value: summary.other, icon: <CircleDollarSign className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-3">
      <section className="rounded-2xl bg-paper p-4 text-paper-ink shadow-card sm:p-5" aria-label="Total do caixa no dia">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-paper-muted">{isToday ? "Total em caixa hoje" : "Total em caixa no dia"}</p>
            <p className={cn("money mt-1.5 text-[30px] font-semibold leading-none tracking-tight sm:text-[36px]", summary.total < 0 && "text-danger")}>
              {summary.total < 0 ? "−" : ""}
              {formatBRL(Math.abs(summary.total))}
            </p>
          </div>
          <span className="rounded-full bg-brand/12 px-2.5 py-1 text-[12px] font-medium text-brand">
            {summary.payments_count} pagamento{summary.payments_count === 1 ? "" : "s"}
          </span>
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-paper-ink/10 pt-3.5 text-[12px] sm:text-[13px]">
          <div className="min-w-0">
            <dt className="text-paper-muted">Recebimentos</dt>
            <dd className="mt-0.5 truncate">
              <Signed value={summary.payments_total} />
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-paper-muted">Estornos</dt>
            <dd className="mt-0.5 truncate">
              <Signed value={summary.reversals_total} />
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-paper-muted">Ajustes</dt>
            <dd className="mt-0.5 truncate">
              <Signed value={summary.adjustments_total} />
            </dd>
          </div>
        </dl>
      </section>

      <MotionList className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {methods.map((m) => (
          <StatCard
            key={m.label}
            label={m.label}
            icon={m.icon}
            value={
              <span className={cn(m.value < 0 && "text-danger-fg")}>
                {m.value < 0 ? "−" : ""}
                {formatBRL(Math.abs(m.value))}
              </span>
            }
            hint={summary.total !== 0 && m.value !== 0 ? `${Math.round((m.value / summary.total) * 100)}% do dia` : "Sem movimento"}
          />
        ))}
      </MotionList>
    </div>
  );
}

/** Totais por usuário responsável pelo lançamento. */
export function ByUserCard({ summary }: { summary: CashDaySummary }) {
  return (
    <Card>
      <CardHeader icon={<Users className="h-4 w-4" />} title="Por responsável" description="Quem lançou as movimentações do dia" />
      <CardBody className="pt-3">
        {summary.by_user.length === 0 ? (
          <p className="py-2 text-[13px] text-fg-muted">Nenhum lançamento neste dia.</p>
        ) : (
          <ul className="divide-y divide-line">
            {summary.by_user.map((u) => (
              <li key={u.user_id ?? "sistema"} className="flex items-center gap-3 py-2.5">
                <Avatar name={u.name ?? "Sistema"} className="h-9 w-9 text-[12px]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-fg">{u.name ?? "Sistema"}</p>
                  <p className="text-[12px] text-fg-muted">
                    {u.count} pagamento{u.count === 1 ? "" : "s"}
                  </p>
                </div>
                <Signed value={u.total} className="text-sm text-fg" />
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
