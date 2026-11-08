import type { Metadata } from "next";
import { History, SearchX } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Pagination } from "@/components/ui/url-controls";
import { ButtonLink } from "@/components/ui/button";
import { HistoryFilters } from "@/features/history/components/history-filters";
import { HistoryList } from "@/features/history/components/history-list";
import {
  HISTORY_PAGE_SIZE,
  getHistory,
  getHistoryCustomerOption,
  getHistoryFilterOptions,
  parseHistoryFilters,
} from "@/features/history/queries";

export const metadata: Metadata = { title: "Histórico" };

export default async function HistoryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireUser();
  const filters = parseHistoryFilters(await searchParams);
  const filtered = Boolean(filters.q || filters.tipo || filters.usuario || filters.cliente || filters.de || filters.ate);

  const [historyRes, optionsRes, customerRes] = await Promise.allSettled([
    getHistory(filters),
    getHistoryFilterOptions(),
    getHistoryCustomerOption(filters.cliente),
  ]);
  const users = optionsRes.status === "fulfilled" ? optionsRes.value.users : [];
  const selectedCustomer = customerRes.status === "fulfilled" ? customerRes.value : null;

  return (
    <>
      <PageHeader
        title="Histórico"
        description="Auditoria de todas as operações do sistema. Os registros não podem ser alterados nem excluídos."
      />
      <HistoryFilters users={users} selectedCustomer={selectedCustomer} />

      {historyRes.status === "rejected" ? (
        <Card>
          <ErrorState title="Não foi possível carregar o histórico" description="Verifique sua conexão e recarregue a página." />
        </Card>
      ) : historyRes.value.items.length === 0 ? (
        <Card>
          {filtered ? (
            <EmptyState
              icon={<SearchX className="h-5 w-5" />}
              title="Nenhum registro encontrado"
              description="Ajuste a busca ou os filtros para ver outras operações."
              action={
                <ButtonLink href="/historico" variant="secondary" size="sm">
                  Limpar filtros
                </ButtonLink>
              }
            />
          ) : (
            <EmptyState
              icon={<History className="h-5 w-5" />}
              title="Nenhuma operação registrada ainda"
              description="Vendas, pagamentos, adiamentos, cadastros e alterações aparecerão aqui automaticamente."
              action={
                <ButtonLink href="/" variant="secondary" size="sm">
                  Voltar ao dashboard
                </ButtonLink>
              }
            />
          )}
        </Card>
      ) : (
        <>
          <p className="tabular mb-3 text-[12.5px] text-fg-muted">
            {historyRes.value.total} {historyRes.value.total === 1 ? "registro" : "registros"}
            {filtered ? " com os filtros aplicados" : ""}
          </p>
          <HistoryList items={historyRes.value.items} />
          <Pagination page={filters.page} pageSize={HISTORY_PAGE_SIZE} total={historyRes.value.total} />
        </>
      )}
    </>
  );
}
