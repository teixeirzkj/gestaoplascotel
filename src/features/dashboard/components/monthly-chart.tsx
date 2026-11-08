import { BarChart3 } from "lucide-react";
import { getDashboardSummary, getMonthlySeries } from "../queries";
import { DashSection, safeLoad } from "./section";
import { SectionError } from "./section-error";
import { MonthlyChartView } from "./monthly-chart-view";

/** Recebido x vendido (6 meses) + recebido no mês x previsto para o mês. */
export async function MonthlyChart() {
  const res = await safeLoad(() => Promise.all([getMonthlySeries(6), getDashboardSummary()]));
  if (!res.ok) return <SectionError title="Gráfico de recebimentos indisponível" />;
  const [series, summary] = res.data;
  return (
    <DashSection title="Recebimentos mensais" description="Recebido x vendido nos últimos 6 meses" icon={<BarChart3 className="h-4 w-4" />}>
      <MonthlyChartView series={series} receivedMonth={summary.received_month} receivable={summary.total_receivable} />
    </DashSection>
  );
}
