import type { Metadata } from "next";
import Link from "next/link";
import { Plus, SearchX, Users } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { MotionList } from "@/components/ui/motion-list";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/states";
import { Pagination } from "@/components/ui/url-controls";
import { requireUser } from "@/lib/auth";
import { formatBRL } from "@/lib/format";
import { CustomerFilters } from "@/features/customers/components/customer-filters";
import { CustomerList } from "@/features/customers/components/customer-list";
import { listActiveCities, listCustomers } from "@/features/customers/queries";
import { PAGE_SIZE, parseCustomerListParams } from "@/features/customers/schemas";

export const metadata: Metadata = { title: "Clientes" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const params = parseCustomerListParams(await searchParams);
  const [{ rows, total, openTotal }, cities] = await Promise.all([listCustomers(params), listActiveCities()]);
  const filtered = Boolean(params.q || params.cityId || params.status || params.archived);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Clientes"
        description="Cadastro, situação financeira e histórico de cada cliente."
        actions={
          user.isOwner && (
            <ButtonLink href="/clientes/novo" className="w-full sm:w-auto">
              <Plus className="h-4 w-4" /> Novo cliente
            </ButtonLink>
          )
        }
      />

      <MotionList className="grid grid-cols-2 gap-3 lg:max-w-xl">
        <StatCard
          label={filtered ? "Clientes encontrados" : "Clientes ativos"}
          value={<span className="tabular">{total.toLocaleString("pt-BR")}</span>}
          hint={params.archived ? "inclui arquivados" : "sem arquivados"}
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label="Total em aberto"
          value={formatBRL(openTotal)}
          hint={filtered ? "dos clientes filtrados" : "de todos os clientes"}
          tone="paper"
        />
      </MotionList>

      <CustomerFilters cities={cities} />

      {rows.length === 0 ? (
        <Card>
          {filtered ? (
            <EmptyState
              icon={<SearchX className="h-5 w-5" />}
              title="Nenhum cliente encontrado"
              description="Revise a busca ou os filtros. Telefones podem ser buscados só pelos números."
              action={
                <Link href="/clientes" className="text-[13px] font-medium text-bronze hover:underline">
                  Limpar filtros
                </Link>
              }
            />
          ) : (
            <EmptyState
              icon={<Users className="h-5 w-5" />}
              title="Nenhum cliente cadastrado"
              description={
                user.isOwner
                  ? "Cadastre o primeiro cliente para registrar vendas e acompanhar cobranças."
                  : "Os clientes cadastrados pelo proprietário aparecerão aqui."
              }
              action={
                user.isOwner && (
                  <ButtonLink href="/clientes/novo">
                    <Plus className="h-4 w-4" /> Cadastrar cliente
                  </ButtonLink>
                )
              }
            />
          )}
        </Card>
      ) : (
        <div>
          <CustomerList rows={rows} />
          <Pagination page={params.page} pageSize={PAGE_SIZE} total={total} />
        </div>
      )}
    </div>
  );
}
