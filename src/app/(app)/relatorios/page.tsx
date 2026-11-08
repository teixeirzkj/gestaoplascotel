import { Suspense } from "react";
import type { Metadata } from "next";
import { requireOwnerPage } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { resolvePeriod } from "@/features/reports/queries";
import { PeriodFilter } from "@/features/reports/components/period-filter";
import { ExportMenu } from "@/features/reports/components/export-menu";
import { MonthlyChartSkeleton } from "@/features/reports/components/monthly-chart";
import {
  CardSkeleton,
  CityBlock,
  DelinquencyBlock,
  MonthlyBlock,
  SummaryBlock,
  SummarySkeleton,
} from "@/features/reports/components/sections";

export const metadata: Metadata = { title: "Relatórios" };

type SP = { periodo?: string | string[]; de?: string | string[]; ate?: string | string[] };

export default async function RelatoriosPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireOwnerPage();
  const period = resolvePeriod(await searchParams);
  const today = todayISO();
  const key = `${period.from}_${period.to}`;
  const range = period.from === period.to ? formatDate(period.from) : `${formatDate(period.from)} a ${formatDate(period.to)}`;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Relatórios"
        description={`Período: ${range}`}
        actions={<ExportMenu from={period.from} to={period.to} />}
        className="mb-0 sm:mb-0"
      />

      <PeriodFilter key={key} period={period.key} from={period.from} to={period.to} today={today} />

      <Suspense key={`s-${key}`} fallback={<SummarySkeleton />}>
        <SummaryBlock from={period.from} to={period.to} today={today} />
      </Suspense>

      <Suspense fallback={<MonthlyChartSkeleton />}>
        <MonthlyBlock />
      </Suspense>

      <Suspense key={`c-${key}`} fallback={<CardSkeleton label="Carregando cidades" height={300} />}>
        <CityBlock from={period.from} to={period.to} />
      </Suspense>

      <Suspense fallback={<CardSkeleton label="Carregando inadimplência" height={340} />}>
        <DelinquencyBlock />
      </Suspense>
    </div>
  );
}
