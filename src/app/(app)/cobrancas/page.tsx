import type { Metadata } from "next";
import { AlertTriangle, CalendarCheck2, CalendarClock, CheckCircle2, Inbox, SearchX, ShieldCheck, Sunrise } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import { MotionList, SwapContent } from "@/components/ui/motion-list";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/states";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/url-controls";
import { requireUser } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { formatBRL, formatDateLong } from "@/lib/format";
import {
  COLLECTIONS_PAGE_SIZE,
  getCityOptions,
  getCollectionOverview,
  listCollectionInstallments,
  listPendingConfirmationPayments,
  type InstallmentPage,
  type PaymentPage,
} from "@/features/collections/queries";
import { COLLECTION_TABS, parseCollectionSort, parseCollectionTab, type CollectionTab } from "@/features/collections/tabs";
import { CollectionsList } from "@/features/collections/components/collections-list";
import { PendingPaymentsList } from "@/features/collections/components/pending-payments-list";
import { CollectionsError, CollectionsFilters } from "@/features/collections/components/collections-filters";

export const metadata: Metadata = { title: "Cobranças" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EMPTY: Record<CollectionTab, { icon: React.ReactNode; title: string; description: string; cta: { label: string; tab: CollectionTab } }> = {
  todas: {
    icon: <CheckCircle2 className="h-5 w-5" />,
    title: "Nenhuma cobrança em aberto",
    description: "Todas as parcelas estão pagas. Novas vendas parceladas aparecem aqui automaticamente.",
    cta: { label: "Ver parcelas pagas", tab: "pagas" },
  },
  hoje: {
    icon: <Sunrise className="h-5 w-5" />,
    title: "Ninguém para cobrar hoje",
    description: "Nenhuma parcela com data de cobrança para hoje. Aproveite para adiantar as próximas.",
    cta: { label: "Ver próximas", tab: "proximas" },
  },
  proximas: {
    icon: <CalendarCheck2 className="h-5 w-5" />,
    title: "Sem cobranças futuras",
    description: "Não há parcelas a vencer depois de hoje.",
    cta: { label: "Ver atrasadas", tab: "atrasadas" },
  },
  atrasadas: {
    icon: <CheckCircle2 className="h-5 w-5" />,
    title: "Nenhuma parcela atrasada",
    description: "Ótimo sinal: nenhum cliente com cobrança vencida.",
    cta: { label: "Ver cobranças de hoje", tab: "hoje" },
  },
  adiadas: {
    icon: <CalendarClock className="h-5 w-5" />,
    title: "Nenhuma cobrança adiada",
    description: "Cobranças com nova data combinada aparecem aqui até serem pagas — inclusive quando a nova data já passou.",
    cta: { label: "Ver todas em aberto", tab: "todas" },
  },
  pagas: {
    icon: <Inbox className="h-5 w-5" />,
    title: "Nenhuma parcela paga ainda",
    description: "Quando um recebimento for confirmado e quitar a parcela, ela aparece aqui.",
    cta: { label: "Ver cobranças de hoje", tab: "hoje" },
  },
  confirmar: {
    icon: <ShieldCheck className="h-5 w-5" />,
    title: "Nada para confirmar",
    description: "Pagamentos registrados como “aguardando confirmação” (ex.: Pix com comprovante) aparecem aqui.",
    cta: { label: "Ver cobranças de hoje", tab: "hoje" },
  },
};

export default async function CobrancasPage({ searchParams }: { searchParams: SearchParams }) {
  await requireUser();
  const sp = await searchParams;
  const tab = parseCollectionTab(first(sp.aba));
  const sort = parseCollectionSort(first(sp.ordem));
  const q = (first(sp.q) ?? "").trim().slice(0, 80) || undefined;
  const cidade = first(sp.cidade);
  const cityId = cidade && UUID_RE.test(cidade) ? cidade : undefined;
  const page = Math.max(1, Math.min(10_000, Number.parseInt(first(sp.page) ?? "1", 10) || 1));
  const filters = { q, cityId };
  const today = todayISO();

  const hrefFor = (t: CollectionTab) => {
    const p = new URLSearchParams();
    if (t !== "todas") p.set("aba", t);
    if (q) p.set("q", q);
    if (cityId) p.set("cidade", cityId);
    const qs = p.toString();
    return qs ? `/cobrancas?${qs}` : "/cobrancas";
  };

  let counts: Record<CollectionTab, number> | null = null;
  let sum = 0;
  let cities: { value: string; label: string }[] = [];
  let installments: InstallmentPage | null = null;
  let payments: PaymentPage | null = null;
  let loadError: string | null = null;

  try {
    const [overview, ci, data] = await Promise.all([
      getCollectionOverview(filters),
      getCityOptions(),
      tab === "confirmar"
        ? listPendingConfirmationPayments({ filters, sort, page })
        : listCollectionInstallments({ tab, filters, sort, page }),
    ]);
    counts = overview.counts;
    sum = overview.sums[tab];
    cities = ci;
    if (tab === "confirmar") payments = data as PaymentPage;
    else installments = data as InstallmentPage;
  } catch {
    loadError = "Verifique sua conexão e tente novamente. Seus dados estão seguros.";
  }

  const total = installments?.total ?? payments?.total ?? 0;
  const hasFilters = Boolean(q || cityId);
  const sumLabel = tab === "pagas" ? "Total pago" : tab === "confirmar" ? "Aguardando confirmação" : "Restante a receber";
  const countLabel = tab === "confirmar" ? "Pagamentos" : tab === "pagas" ? "Parcelas pagas" : "Parcelas";
  const tabLabel = COLLECTION_TABS.find((t) => t.value === tab)?.label ?? "";
  const empty = EMPTY[tab];

  return (
    <div className="min-w-0">
      <PageHeader title="Cobranças" description={`Quem cobrar, quando e quanto · ${formatDateLong(today)}`} />

      <Tabs
        className="mb-4"
        value={tab}
        items={COLLECTION_TABS.map((t) => ({ value: t.value, label: t.label, count: counts?.[t.value], href: hrefFor(t.value) }))}
      />

      <div className="mb-4">
        <CollectionsFilters cities={cities} tab={tab} />
      </div>

      <SwapContent id={tab}>
        {loadError ? (
          <Card>
            <CollectionsError message={loadError} />
          </Card>
        ) : (
          <>
            <MotionList className="mb-4 grid grid-cols-2 gap-3">
              <StatCard
                label={sumLabel}
                value={formatBRL(sum)}
                hint={hasFilters ? `${tabLabel} · com filtros` : tabLabel}
                tone="paper"
              />
              <StatCard
                label={countLabel}
                value={<span className="tabular">{total}</span>}
                hint={
                  tab === "atrasadas" && total > 0 ? (
                    <span className="inline-flex items-center gap-1 text-danger-fg">
                      <AlertTriangle className="h-3 w-3" aria-hidden /> priorize os mais antigos
                    </span>
                  ) : (
                    `${COLLECTIONS_PAGE_SIZE} por página`
                  )
                }
                tone={tab === "atrasadas" && total > 0 ? "danger" : "default"}
              />
            </MotionList>

            {total === 0 ? (
              <Card>
                {hasFilters ? (
                  <EmptyState
                    icon={<SearchX className="h-5 w-5" />}
                    title="Nada encontrado com esses filtros"
                    description="Confira a grafia do nome, o telefone ou a cidade selecionada."
                    action={
                      <ButtonLink href={tab === "todas" ? "/cobrancas" : `/cobrancas?aba=${tab}`} variant="secondary" size="md">
                        Limpar filtros
                      </ButtonLink>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={empty.icon}
                    title={empty.title}
                    description={empty.description}
                    action={
                      <ButtonLink href={hrefFor(empty.cta.tab)} variant="secondary" size="md">
                        {empty.cta.label}
                      </ButtonLink>
                    }
                  />
                )}
              </Card>
            ) : (installments?.rows.length ?? payments?.rows.length ?? 0) === 0 ? (
              <Card>
                <EmptyState
                  title="Esta página não tem registros"
                  description="A lista mudou desde que você abriu este link."
                  action={
                    <ButtonLink href={hrefFor(tab)} variant="secondary" size="md">
                      Ir para a primeira página
                    </ButtonLink>
                  }
                />
              </Card>
            ) : (
              <>
                {installments && <CollectionsList rows={installments.rows} />}
                {payments && <PendingPaymentsList rows={payments.rows} />}
                <Pagination page={page} pageSize={COLLECTIONS_PAGE_SIZE} total={total} />
              </>
            )}
          </>
        )}
      </SwapContent>
    </div>
  );
}
