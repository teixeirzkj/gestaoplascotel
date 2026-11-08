import { Suspense } from "react";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { Greeting } from "@/features/dashboard/components/greeting";
import { AccessNotice } from "@/features/dashboard/components/access-notice";
import { KpiGrid } from "@/features/dashboard/components/kpi-grid";
import { QuickActions } from "@/features/dashboard/components/quick-actions";
import { AttentionToday } from "@/features/dashboard/components/attention-today";
import { MonthlyChart } from "@/features/dashboard/components/monthly-chart";
import { FinancialSummary } from "@/features/dashboard/components/financial-summary";
import { CustomersAttention, RecentActivity, UpcomingInstallments, UpcomingVisits } from "@/features/dashboard/components/lists";
import { AttentionSkeleton, ChartSkeleton, KpiSkeleton, SectionSkeleton } from "@/features/dashboard/components/skeletons";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * Dashboard. Cada seção é um Server Component assíncrono em seu próprio <Suspense> (streaming)
 * e trata o próprio erro, sem derrubar a página.
 * Celular: KPIs → Atenção hoje → Ações rápidas → Próximas cobranças → Gráfico → demais.
 * Desktop: grade de 12 colunas (Atenção hoje + gráfico à esquerda; resumo/listas à direita).
 */
export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [user, sp] = await Promise.all([requireUser(), searchParams]);
  const denied = sp.acesso === "negado";

  return (
    <>
      <AccessNotice denied={denied} />
      <Greeting name={user.full_name || user.email || ""} />

      <Suspense fallback={<KpiSkeleton />}>
        <KpiGrid />
      </Suspense>

      <div className="mt-4 flex flex-col gap-4 lg:mt-5 lg:grid lg:grid-cols-12 lg:items-start lg:gap-5">
        {/* Coluna principal */}
        <div className="contents lg:col-span-7 lg:flex lg:min-w-0 lg:flex-col lg:gap-5 xl:col-span-8">
          <section className="order-1 min-w-0 lg:order-none" aria-label="Atenção hoje">
            <Suspense fallback={<AttentionSkeleton />}>
              <AttentionToday />
            </Suspense>
          </section>
          <section className="order-4 min-w-0 lg:order-none" aria-label="Recebimentos mensais">
            <Suspense fallback={<ChartSkeleton />}>
              <MonthlyChart />
            </Suspense>
          </section>
          <section className="order-6 min-w-0 lg:order-none" aria-label="Clientes que precisam de atenção">
            <Suspense fallback={<SectionSkeleton rows={4} />}>
              <CustomersAttention />
            </Suspense>
          </section>
          <section className="order-8 min-w-0 lg:order-none" aria-label="Últimas movimentações">
            <Suspense fallback={<SectionSkeleton rows={6} />}>
              <RecentActivity />
            </Suspense>
          </section>
        </div>

        {/* Coluna lateral */}
        <div className="contents lg:col-span-5 lg:flex lg:min-w-0 lg:flex-col lg:gap-5 xl:col-span-4">
          <section className="order-2 min-w-0 lg:order-none">
            <QuickActions isOwner={user.isOwner} />
          </section>
          <section className="order-5 min-w-0 lg:order-none" aria-label="Resumo financeiro">
            <Suspense fallback={<SectionSkeleton rows={6} />}>
              <FinancialSummary />
            </Suspense>
          </section>
          <section className="order-3 min-w-0 lg:order-none" aria-label="Próximas cobranças">
            <Suspense fallback={<SectionSkeleton rows={4} tall />}>
              <UpcomingInstallments />
            </Suspense>
          </section>
          <section className="order-7 min-w-0 lg:order-none" aria-label="Próximas visitas">
            <Suspense fallback={<SectionSkeleton rows={3} tall />}>
              <UpcomingVisits />
            </Suspense>
          </section>
        </div>
      </div>
    </>
  );
}
