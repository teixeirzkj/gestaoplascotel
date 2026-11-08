import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, MapPin, Route as RouteIcon, StickyNote, UserRound, Users } from "lucide-react";
import { PageHeader, SectionTitle } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { MotionItem, MotionList } from "@/components/ui/motion-list";
import { requireUser } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { formatDate, formatDateTime } from "@/lib/format";
import { VISIT_CUSTOMER_STATUS, VISIT_STATUS } from "@/lib/labels";
import { getVisitDetail } from "@/features/agenda/queries";
import { compareStops } from "@/features/agenda/route";
import { formatDateTitle, formatVisitTime, relativeDayLabel } from "@/features/agenda/utils";
import { VisitActions } from "@/features/agenda/components/visit-actions";
import { VisitProgress } from "@/features/agenda/components/visit-progress";
import { VisitCustomerCard } from "@/features/agenda/components/visit-customer-card";
import { AddCustomersButton } from "@/features/agenda/components/add-customers-button";
import { DateSemanticsLegend, TypedDate } from "@/features/agenda/components/date-semantics";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  if (!UUID.test(id)) return { title: "Visita" };
  const visit = await getVisitDetail(id);
  return { title: visit ? `Visita · ${visit.cityName} ${formatDate(visit.visitDate)}` : "Visita" };
}

export default async function VisitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const visit = await getVisitDetail(id);
  if (!visit) notFound();

  const today = todayISO();
  const time = formatVisitTime(visit.visitTime);
  const customers = [...visit.customers].sort((a, b) =>
    compareStops(
      { ...a, visitCustomerId: a.id, fullName: a.fullName },
      { ...b, visitCustomerId: b.id, fullName: b.fullName },
    ),
  );
  const attended = customers.filter((c) => c.status !== "to_visit").length;
  const counts = Object.keys(VISIT_CUSTOMER_STATUS).map((k) => ({ status: k, count: customers.filter((c) => c.status === k).length }));

  return (
    <>
      <PageHeader
        back={{ href: "/agenda", label: "Agenda" }}
        title={
          <span className="flex flex-wrap items-center gap-2">
            Visita a {visit.cityName}
            <span className="text-[15px] font-medium text-fg-subtle sm:text-[17px]">{visit.cityState}</span>
          </span>
        }
        description={
          <span>
            {formatDateTitle(visit.visitDate)}
            {time && <span> · {time}</span>}
            <span className="text-fg-subtle"> · {relativeDayLabel(visit.visitDate, today)}</span>
          </span>
        }
        actions={
          <VisitActions
            attendedCount={attended}
            visit={{ id: visit.id, cityName: visit.cityName, visitDate: visit.visitDate, visitTime: visit.visitTime, notes: visit.notes, status: visit.status }}
          />
        }
      />

      <Card className="mb-5 overflow-hidden">
        <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:gap-6">
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={visit.status} map={VISIT_STATUS} />
              <TypedDate kind="visit" date={visit.visitDate} />
              <span className="inline-flex items-center gap-1.5 text-[12px] text-fg-muted">
                <Clock className="h-3.5 w-3.5 text-fg-subtle" aria-hidden />
                {time ?? "Sem horário"}
              </span>
            </div>
            <Link href={`/cidades/${visit.cityId}`} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-bronze hover:underline">
              <MapPin className="h-3.5 w-3.5" aria-hidden /> Ver cidade e clientes para visitar
            </Link>
            {visit.notes && (
              <p className="flex items-start gap-1.5 text-[13px] leading-relaxed text-fg-muted">
                <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fg-subtle" aria-hidden />
                <span className="whitespace-pre-line">{visit.notes}</span>
              </p>
            )}
            <p className="flex items-center gap-1.5 text-[12px] text-fg-subtle">
              <UserRound className="h-3.5 w-3.5" aria-hidden />
              Agendada {visit.createdByName ? `por ${visit.createdByName} ` : ""}em {formatDateTime(visit.createdAt)}
            </p>
          </div>
          <div className="min-w-0 rounded-xl bg-bg-elevated p-3.5">
            {customers.length > 0 ? (
              <>
                <VisitProgress attended={attended} total={customers.length} />
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {counts
                    .filter((c) => c.count > 0)
                    .map((c) => (
                      <StatusBadge
                        key={c.status}
                        status={c.status}
                        map={{ [c.status]: { ...VISIT_CUSTOMER_STATUS[c.status], label: `${VISIT_CUSTOMER_STATUS[c.status].label}: ${c.count}` } }}
                      />
                    ))}
                </div>
              </>
            ) : (
              <p className="text-[13px] text-fg-muted">Adicione clientes para acompanhar o progresso desta visita.</p>
            )}
          </div>
        </div>
        <div className="border-t border-line px-4 py-2.5 sm:px-5">
          <DateSemanticsLegend />
        </div>
      </Card>

      <SectionTitle
        action={
          <div className="flex items-center gap-2">
            <ButtonLink href={`/agenda?visao=roteiro&data=${visit.visitDate}`} variant="ghost" size="sm">
              <RouteIcon className="h-4 w-4" /> <span className="hidden xs:inline">Roteiro</span>
            </ButtonLink>
            {visit.status !== "cancelled" && (
              <AddCustomersButton
                visitId={visit.id}
                cityId={visit.cityId}
                cityName={visit.cityName}
                existingCustomerIds={customers.map((c) => c.customerId)}
              />
            )}
          </div>
        }
      >
        Clientes ({customers.length})
      </SectionTitle>

      {customers.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title="Nenhum cliente nesta visita"
            description="Adicione os clientes da cidade que precisam de atendimento presencial."
            action={
              visit.status !== "cancelled" ? (
                <AddCustomersButton visitId={visit.id} cityId={visit.cityId} cityName={visit.cityName} existingCustomerIds={[]} variant="primary" />
              ) : undefined
            }
          />
        </Card>
      ) : (
        <MotionList className="grid gap-3 xl:grid-cols-2">
          {customers.map((c, i) => (
            <MotionItem key={c.id}>
              <VisitCustomerCard customer={c} position={i + 1} cityName={visit.cityName} cityState={visit.cityState} visitStatus={visit.status} />
            </MotionItem>
          ))}
        </MotionList>
      )}
    </>
  );
}
