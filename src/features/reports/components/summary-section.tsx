import { AlertTriangle, CalendarClock, CheckCircle2, HandCoins, ShoppingBag, Users, Wallet, Receipt } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { MotionList } from "@/components/ui/motion-list";
import { SectionTitle } from "@/components/ui/page-header";
import { formatBRL, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ReportSummary } from "@/types/database";

const METHOD_META = [
  { key: "pix", label: "Pix", cls: "bg-bronze" },
  { key: "cash", label: "Dinheiro", cls: "bg-success" },
  { key: "transfer", label: "Transferência", cls: "bg-info" },
  { key: "other", label: "Outros", cls: "bg-fg-subtle" },
] as const;

export function SummarySection({ summary, today }: { summary: ReportSummary; today: string }) {
  const s = summary;
  const ticket = s.sales_count > 0 ? s.total_sold / s.sales_count : 0;

  return (
    <div className="space-y-5">
      <section aria-labelledby="period-kpis">
        <SectionTitle>
          <span id="period-kpis">No período</span>
        </SectionTitle>
        <MotionList className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard tone="paper" label="Total vendido" value={formatBRL(s.total_sold)} hint="Faturamento (vendas não canceladas)" icon={<ShoppingBag className="h-4 w-4" />} />
          <StatCard tone="success" label="Total recebido" value={formatBRL(s.total_received)} hint="Pagamentos confirmados" icon={<HandCoins className="h-4 w-4" />} />
          <StatCard label="Vendas" value={<span className="tabular">{s.sales_count}</span>} hint={`Ticket médio ${formatBRL(ticket)}`} icon={<Receipt className="h-4 w-4" />} />
          <StatCard
            label="Vendas quitadas"
            value={<span className="tabular">{s.paid_sales_count}</span>}
            hint={s.sales_count ? `${Math.round((s.paid_sales_count / s.sales_count) * 100)}% das vendas do período` : "Nenhuma venda no período"}
            icon={<CheckCircle2 className="h-4 w-4" />}
          />
        </MotionList>
      </section>

      <section aria-labelledby="position-kpis">
        <SectionTitle action={<span className="text-[12px] text-fg-subtle">Posição em {formatDate(today)}</span>}>
          <span id="position-kpis">Carteira hoje</span>
        </SectionTitle>
        <MotionList className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <StatCard label="Saldo a receber" value={formatBRL(s.total_pending)} hint="Todas as parcelas em aberto" icon={<Wallet className="h-4 w-4" />} />
          <StatCard tone="danger" label="Em atraso" value={formatBRL(s.total_overdue)} hint="Parcelas vencidas não pagas" icon={<AlertTriangle className="h-4 w-4" />} />
          <StatCard
            tone={s.delinquent_customers > 0 ? "warning" : "default"}
            label="Clientes inadimplentes"
            value={<span className="tabular">{s.delinquent_customers}</span>}
            hint="Com ao menos 1 parcela atrasada"
            icon={<Users className="h-4 w-4" />}
            className="col-span-2 lg:col-span-1"
          />
        </MotionList>
      </section>

      <MethodBreakdown summary={s} />
    </div>
  );
}

function MethodBreakdown({ summary }: { summary: ReportSummary }) {
  const total = summary.total_received;
  const items = METHOD_META.map((m) => ({ ...m, value: summary.received_by_method[m.key] }));
  const positive = items.filter((i) => i.value > 0);
  const pct = (v: number) => (total > 0 ? (v / total) * 100 : 0);

  return (
    <Card>
      <CardHeader icon={<CalendarClock className="h-4 w-4" />} title="Recebido por forma de pagamento" description={`Total recebido no período: ${formatBRL(total)}`} />
      <CardBody className="pt-4">
        {total <= 0 ? (
          <p className="text-[13px] text-fg-muted">Nenhum pagamento confirmado no período.</p>
        ) : (
          <>
            <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-bg-elevated" role="img" aria-label="Distribuição do recebido por forma de pagamento">
              {positive.map((i) => (
                <span key={i.key} className={cn("h-full first:rounded-l-full last:rounded-r-full", i.cls)} style={{ width: `${pct(i.value)}%` }} title={`${i.label}: ${formatBRL(i.value)}`} />
              ))}
            </div>
            <ul className="mt-4 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
              {items.map((i) => (
                <li key={i.key} className="flex items-center gap-3 py-1.5 text-sm">
                  <span className={cn("h-2.5 w-2.5 shrink-0 rounded-[3px]", i.cls)} aria-hidden />
                  <span className="flex-1 text-fg-muted">{i.label}</span>
                  <span className="money font-semibold text-fg">{formatBRL(i.value)}</span>
                  <span className="tabular w-11 text-right text-[12px] text-fg-subtle">{Math.round(pct(i.value))}%</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardBody>
    </Card>
  );
}
