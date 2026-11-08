import type { Metadata } from "next";
import { Archive, MapPin } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { ButtonLink } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { formatBRL } from "@/lib/format";
import { listCities } from "@/features/cities/queries";
import { CITY_SORTS, type CitySort } from "@/features/cities/schemas";
import { CitiesToolbar } from "@/features/cities/components/cities-toolbar";
import { CityList } from "@/features/cities/components/city-list";
import { NewCityButton } from "@/features/cities/components/city-owner-actions";

export const metadata: Metadata = { title: "Cidades" };

export default async function CitiesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const archived = sp.arquivadas === "1";
  const sortParam = typeof sp.ordem === "string" ? sp.ordem : "";
  const sort: CitySort = CITY_SORTS.some((s) => s.value === sortParam) ? (sortParam as CitySort) : "pendente";

  const items = await listCities({ archived, q, sort });
  const today = todayISO();
  const totalPending = items.reduce((s, c) => s + c.pending, 0);
  const totalOverdue = items.reduce((s, c) => s + c.overdue, 0);

  return (
    <>
      <PageHeader
        title="Cidades"
        description={
          items.length > 0 && !archived ? (
            <>
              {items.length} {items.length === 1 ? "cidade" : "cidades"} · <span className="money">{formatBRL(totalPending)}</span> pendente
              {totalOverdue > 0 && (
                <>
                  {" "}· <span className="money text-danger">{formatBRL(totalOverdue)}</span> em atraso
                </>
              )}
            </>
          ) : (
            "Clientes, cobranças e visitas organizados por cidade."
          )
        }
        actions={<NewCityButton className="w-full sm:w-auto" />}
      />
      <CitiesToolbar />
      {items.length === 0 ? (
        <Card>
          {q ? (
            <EmptyState
              title="Nenhuma cidade encontrada"
              description={`Nada corresponde a “${q}”. Confira a grafia ou limpe a busca.`}
              action={
                <ButtonLink href={archived ? "/cidades?arquivadas=1" : "/cidades"} variant="secondary" size="sm">
                  Limpar busca
                </ButtonLink>
              }
            />
          ) : archived ? (
            <EmptyState
              icon={<Archive className="h-5 w-5" />}
              title="Nenhuma cidade arquivada"
              description="Cidades arquivadas saem da agenda, mas mantêm clientes e histórico."
              action={
                <ButtonLink href="/cidades" variant="secondary" size="sm">
                  Ver cidades ativas
                </ButtonLink>
              }
            />
          ) : (
            <EmptyState
              icon={<MapPin className="h-5 w-5" />}
              title="Nenhuma cidade cadastrada"
              description={
                user.isOwner
                  ? "Cadastre as cidades atendidas para organizar clientes, cobranças e o roteiro de visitas."
                  : "O proprietário ainda não cadastrou cidades. Assim que houver, elas aparecerão aqui."
              }
              action={<NewCityButton />}
            />
          )}
        </Card>
      ) : (
        <CityList items={items} today={today} />
      )}
    </>
  );
}
