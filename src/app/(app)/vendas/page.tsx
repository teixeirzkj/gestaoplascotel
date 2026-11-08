import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Receipt, SearchX, ShoppingBag, Wallet } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { isISODate, periodRange, todayISO, type PeriodKey } from "@/lib/dates";
import { formatBRL, formatDate } from "@/lib/format";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { MotionList } from "@/components/ui/motion-list";
import { StatCard } from "@/components/ui/stat-card";
import { Pagination } from "@/components/ui/url-controls";
import { listCities, listSales } from "@/features/sales/queries";
import { SalesFilters } from "@/features/sales/components/sales-filters";
import { SalesList } from "@/features/sales/components/sales-list";
import type { SaleStatus } from "@/types/database";

export const metadata: Metadata = { title: "Vendas" };

const PAGE_SIZE = 20;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES: SaleStatus[] = ["open", "paid", "cancelled"];
const PERIODS: PeriodKey[] = ["today", "7d", "30d", "month", "last_month", "custom"];

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function SalesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const today = todayISO();

  const q = one(sp.q)?.trim() || undefined;
  const rawStatus = one(sp.status);
  const status = STATUSES.find((s) => s === rawStatus);
  const rawCity = one(sp.cidade);
  const cityId = rawCity && UUID_RE.test(rawCity) ? rawCity : undefined;
  const rawPeriod = one(sp.periodo);
  const period = PERIODS.find((p) => p === rawPeriod);
  const range = period
    ? periodRange(period, {
        from: isISODate(one(sp.de)) ? one(sp.de) : undefined,
        to: isISODate(one(sp.ate)) ? one(sp.ate) : undefined,
      })
    : undefined;
  const page = Math.max(1, Number(one(sp.page)) || 1);

  const [{ rows, total, totals }, cities] = await Promise.all([
    listSales({ q, status, cityId, from: range?.from, to: range?.to, page, pageSize: PAGE_SIZE }),
    listCities(),
  ]);
  const hasFilters = Boolean(q || status || cityId || period);

  return (
    <>
      <PageHeader
        title="Vendas"
        description="Vendas registradas, saldos e próximas cobranças."
        actions={
          user.isOwner && (
            <ButtonLink href="/vendas/nova" className="w-full sm:w-auto">
              <Plus className="h-4 w-4" /> Nova venda
            </ButtonLink>
          )
        }
      />

      <MotionList className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard
          tone="paper"
          label={hasFilters ? "Vendido no filtro" : "Total vendido"}
          value={formatBRL(totals.sold)}
          hint={`${totals.count} ${totals.count === 1 ? "venda" : "vendas"} (sem canceladas)`}
          icon={<ShoppingBag className="h-4 w-4" />}
        />
        <StatCard
          tone={totals.balance > 0 ? "warning" : "default"}
          label="Saldo a receber"
          value={formatBRL(totals.balance)}
          hint={hasFilters ? "Das vendas filtradas" : "De todas as vendas"}
          icon={<Wallet className="h-4 w-4" />}
        />
        <StatCard
          label="Recebido"
          value={formatBRL(totals.paid)}
          hint="Pagamentos confirmados"
          icon={<Receipt className="h-4 w-4" />}
          className="col-span-2 lg:col-span-1"
        />
      </MotionList>

      <SalesFilters cities={cities} today={today} />

      {rows.length === 0 ? (
        <Card>
          {hasFilters ? (
            <EmptyState
              icon={<SearchX className="h-5 w-5" />}
              title="Nenhuma venda encontrada"
              description="Nenhuma venda corresponde à busca e aos filtros selecionados."
              action={
                <Link href="/vendas" className={buttonClasses("secondary", "sm")}>
                  Limpar filtros
                </Link>
              }
            />
          ) : (
            <EmptyState
              icon={<ShoppingBag className="h-5 w-5" />}
              title="Nenhuma venda registrada"
              description={
                user.isOwner
                  ? "Registre a primeira venda: as parcelas são geradas automaticamente e entram nas cobranças."
                  : "As vendas registradas pelo proprietário aparecerão aqui."
              }
              action={
                user.isOwner && (
                  <ButtonLink href="/vendas/nova" size="sm">
                    <Plus className="h-4 w-4" /> Registrar venda
                  </ButtonLink>
                )
              }
            />
          )}
        </Card>
      ) : (
        <>
          <p className="tabular mb-2 text-[12px] text-fg-subtle">
            {total} {total === 1 ? "venda" : "vendas"}
            {range && (
              <>
                {" "}
                · {formatDate(range.from)} a {formatDate(range.to)}
              </>
            )}
          </p>
          <SalesList rows={rows} today={today} />
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} />
        </>
      )}
    </>
  );
}
