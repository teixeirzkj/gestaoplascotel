import type { Metadata } from "next";
import { requireOwnerPage } from "@/lib/auth";
import { isISODate, todayISO } from "@/lib/dates";
import { formatDateLong } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { FadeIn } from "@/components/ui/motion-list";
import { getCashDay, getCashMovements, getDailyTotals, getRecentClosings } from "@/features/cash/queries";
import { DateNav } from "@/features/cash/components/date-nav";
import { AdjustmentButton } from "@/features/cash/components/adjustment-dialog";
import { DaySummary, ByUserCard } from "@/features/cash/components/day-summary";
import { MovementsList } from "@/features/cash/components/movements-list";
import { ClosingCard } from "@/features/cash/components/closing-card";
import { WeekBars } from "@/features/cash/components/week-bars";
import { ClosingsHistory } from "@/features/cash/components/closings-history";
import { CsvButton } from "@/features/reports/components/export-menu";

export const metadata: Metadata = { title: "Caixa" };

export default async function CaixaPage({ searchParams }: { searchParams: Promise<{ data?: string | string[] }> }) {
  const user = await requireOwnerPage();
  const sp = await searchParams;
  const today = todayISO();
  const raw = typeof sp.data === "string" && isISODate(sp.data) ? sp.data : today;
  const date = raw > today ? today : raw;
  const isToday = date === today;

  const [summary, movements, closings, week] = await Promise.all([
    getCashDay(date),
    getCashMovements(date),
    getRecentClosings(30),
    getDailyTotals(date, 7),
  ]);

  const expected = { total: summary.total, pix: summary.pix, cash: summary.cash, transfer: summary.transfer, other: summary.other };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Caixa"
        description={`Fechamento diário · ${isToday ? "hoje, " : ""}${formatDateLong(date)}`}
        actions={<AdjustmentButton defaultDate={date} today={today} className="w-full xs:w-auto" />}
        className="mb-0 sm:mb-0"
      />

      <DateNav date={date} today={today} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-5">
          <DaySummary summary={summary} isToday={isToday} />
          <FadeIn delay={0.05}>
            <MovementsList
              movements={movements}
              date={date}
              action={movements.length > 0 ? <CsvButton kind="caixa" from={date} to={date} label="CSV" /> : undefined}
            />
          </FadeIn>
        </div>

        <aside className="min-w-0 space-y-5">
          <FadeIn delay={0.04}>
            <ClosingCard date={date} closing={summary.closing} expected={expected} isOwner={user.isOwner} />
          </FadeIn>
          <FadeIn delay={0.08}>
            <ByUserCard summary={summary} />
          </FadeIn>
          <FadeIn delay={0.12}>
            <WeekBars days={week} selected={date} today={today} />
          </FadeIn>
        </aside>
      </div>

      <FadeIn delay={0.1}>
        <ClosingsHistory closings={closings} today={today} />
      </FadeIn>
    </div>
  );
}
