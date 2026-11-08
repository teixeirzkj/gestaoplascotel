import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AlertTriangle, CalendarCheck2, CalendarPlus, StickyNote, Users, Wallet } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { MotionList } from "@/components/ui/motion-list";
import { requireUser } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { formatBRL, formatDate } from "@/lib/format";
import { getCityDetail } from "@/features/cities/queries";
import { CityOwnerActions } from "@/features/cities/components/city-owner-actions";
import { CityCustomersList, CityVisitsList, ToVisitList } from "@/features/cities/components/city-sections";
import { relativeDayLabel } from "@/features/agenda/utils";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  if (!UUID.test(id)) return { title: "Cidade" };
  const detail = await getCityDetail(id);
  return { title: detail ? `${detail.city.name}/${detail.city.state}` : "Cidade" };
}

export default async function CityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const detail = await getCityDetail(id);
  if (!detail) notFound();

  const { city, totals, customers, toVisit, upcomingVisits, pastVisits } = detail;
  const today = todayISO();
  const scheduleHref = `/agenda?nova=1&cidade=${city.id}`;

  return (
    <>
      <PageHeader
        back={{ href: "/cidades", label: "Cidades" }}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {city.name}
            <span className="text-[15px] font-medium text-fg-subtle sm:text-[17px]">{city.state}</span>
            {city.archived && <Badge tone="muted">Arquivada</Badge>}
          </span>
        }
        description={
          city.next_visit_date ? (
            <>
              Próxima visita em <span className="tabular font-medium text-fg">{formatDate(city.next_visit_date)}</span> ({relativeDayLabel(city.next_visit_date, today)})
            </>
          ) : (
            "Nenhuma visita futura agendada para esta cidade."
          )
        }
        actions={
          <>
            {!city.archived && (
              <ButtonLink href={scheduleHref}>
                <CalendarPlus className="h-4 w-4" /> Agendar visita
              </ButtonLink>
            )}
            <CityOwnerActions archived={city.archived} city={{ id: city.id, name: city.name, state: city.state, notes: city.notes }} />
          </>
        }
      />

      <MotionList className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Pendente"
          tone="paper"
          value={formatBRL(totals.pending)}
          hint="Saldo a receber na cidade"
          icon={<Wallet className="h-4 w-4" />}
        />
        <StatCard
          label="Em atraso"
          tone={totals.overdue > 0 ? "danger" : "default"}
          value={formatBRL(totals.overdue)}
          hint={totals.overdueCustomers > 0 ? `${totals.overdueCustomers} ${totals.overdueCustomers === 1 ? "cliente" : "clientes"}` : "Nenhum atraso"}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <StatCard
          label="Clientes"
          value={<span className="tabular">{totals.customersCount}</span>}
          hint={`${toVisit.length} para visitar`}
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label="Última visita"
          value={<span className="tabular">{city.last_visit_date ? formatDate(city.last_visit_date) : "—"}</span>}
          hint={city.last_visit_date ? relativeDayLabel(city.last_visit_date, today) : "Nunca visitada"}
          icon={<CalendarCheck2 className="h-4 w-4" />}
        />
      </MotionList>

      {city.notes && (
        <Card className="mb-5 flex items-start gap-3 p-4 sm:px-5">
          <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-bronze" aria-hidden />
          <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-fg-muted">{city.notes}</p>
        </Card>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid min-w-0 gap-5">
          <Card>
            <CardHeader
              title="Clientes para visitar"
              description="Atrasos, adiamentos, promessas não cumpridas, pedidos de visita e cobranças próximas."
              action={
                toVisit.length > 0 && !city.archived ? (
                  <ButtonLink href={scheduleHref} variant="secondary" size="sm">
                    <CalendarPlus className="h-4 w-4" /> <span className="hidden xs:inline">Agendar</span>
                  </ButtonLink>
                ) : undefined
              }
            />
            <div className="mt-3 border-t border-line">
              {toVisit.length ? (
                <ToVisitList items={toVisit} />
              ) : (
                <EmptyState compact title="Ninguém precisa de visita agora" description="Nenhum cliente da cidade com atraso, adiamento ou cobrança nos próximos 7 dias." />
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Clientes da cidade" description={`${customers.length} ${customers.length === 1 ? "cliente ativo" : "clientes ativos"}`} />
            <div className="mt-3 border-t border-line">
              {customers.length ? (
                <CityCustomersList items={customers} />
              ) : (
                <EmptyState
                  compact
                  icon={<Users className="h-5 w-5" />}
                  title="Nenhum cliente nesta cidade"
                  description="Ao cadastrar um cliente, selecione esta cidade para que ele apareça aqui e no roteiro."
                  action={
                    <ButtonLink href="/clientes" variant="secondary" size="sm">
                      Ir para clientes
                    </ButtonLink>
                  }
                />
              )}
            </div>
          </Card>
        </div>

        <Card className="min-w-0">
          <CardHeader title="Próximas visitas" description="Datas de visita à cidade" />
          <div className="mt-2">
            <CityVisitsList items={upcomingVisits} today={today} empty="Nenhuma visita futura." />
          </div>
          <div className="mt-2 border-t border-line pt-1">
            <CardHeader title="Visitas anteriores" className="pt-3 sm:pt-4" />
            <div className="mt-2 pb-1">
              <CityVisitsList items={pastVisits} today={today} empty="Nenhuma visita registrada." />
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
