import { Card } from "@/components/ui/card";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { FadeIn } from "@/components/ui/motion-list";
import {
  getDelinquencyAging,
  getMonthlySeries,
  getOverdueInstallments,
  getReportByCity,
  getReportSummary,
  ReportError,
} from "../queries";
import { SummarySection } from "./summary-section";
import { MonthlyChart } from "./monthly-chart";
import { CityReport } from "./city-report";
import { DelinquencyPanel } from "./delinquency-panel";

const OVERDUE_LIMIT = 3000;

function SectionError({ error, title }: { error: unknown; title: string }) {
  const description = error instanceof ReportError ? error.message : "Verifique sua conexão e recarregue a página.";
  return (
    <Card>
      <ErrorState title={title} description={description} />
    </Card>
  );
}

/** Carrega dados e trata erro por seção, sem derrubar a página inteira. */
async function load<T>(fn: () => Promise<T>): Promise<{ ok: true; data: T } | { ok: false; error: unknown }> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    return { ok: false, error };
  }
}

export async function SummaryBlock({ from, to, today }: { from: string; to: string; today: string }) {
  const r = await load(() => getReportSummary(from, to));
  if (!r.ok) return <SectionError error={r.error} title="Indicadores indisponíveis" />;
  return (
    <FadeIn>
      <SummarySection summary={r.data} today={today} />
    </FadeIn>
  );
}

export async function MonthlyBlock() {
  const r = await load(() => getMonthlySeries(12));
  if (!r.ok) return <SectionError error={r.error} title="Gráfico mensal indisponível" />;
  return (
    <FadeIn>
      <MonthlyChart data={r.data} />
    </FadeIn>
  );
}

export async function CityBlock({ from, to }: { from: string; to: string }) {
  const r = await load(() => getReportByCity(from, to));
  if (!r.ok) return <SectionError error={r.error} title="Relatório por cidade indisponível" />;
  return (
    <FadeIn>
      <CityReport rows={r.data} />
    </FadeIn>
  );
}

export async function DelinquencyBlock() {
  const r = await load(() => Promise.all([getDelinquencyAging(), getOverdueInstallments(OVERDUE_LIMIT)]));
  if (!r.ok) return <SectionError error={r.error} title="Painel de inadimplência indisponível" />;
  const [buckets, installments] = r.data;
  return (
    <FadeIn>
      <DelinquencyPanel buckets={buckets} installments={installments} truncated={installments.length >= OVERDUE_LIMIT} />
    </FadeIn>
  );
}

export function SummarySkeleton() {
  return (
    <div className="space-y-5" role="status" aria-label="Carregando indicadores">
      <div>
        <Skeleton className="mb-3 h-4 w-24" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[92px] rounded-2xl" />
          ))}
        </div>
      </div>
      <div>
        <Skeleton className="mb-3 h-4 w-28" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Skeleton className="h-[92px] rounded-2xl" />
          <Skeleton className="h-[92px] rounded-2xl" />
          <Skeleton className="col-span-2 h-[92px] rounded-2xl lg:col-span-1" />
        </div>
      </div>
      <Skeleton className="h-[170px] rounded-2xl" />
    </div>
  );
}

export function CardSkeleton({ height = 280, label }: { height?: number; label: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4 sm:p-5" role="status" aria-label={label}>
      <Skeleton className="h-5 w-44" />
      <Skeleton className="mt-2 h-4 w-72 max-w-full" />
      <div className="mt-5 space-y-2" style={{ minHeight: height - 90 }}>
        {Array.from({ length: Math.max(2, Math.round((height - 90) / 56)) }).map((_, i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
    </div>
  );
}
