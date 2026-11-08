import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { endOfMonthISO, isISODate, todayISO } from "@/lib/dates";
import {
  getRouteDay,
  listActiveCities,
  listCitiesNeedingVisit,
  listRouteDates,
  listUpcomingVisits,
  listVisitHistory,
  listVisitsInRange,
} from "@/features/agenda/queries";
import { AGENDA_VIEWS, parseMonthParam, type AgendaView } from "@/features/agenda/utils";
import { AgendaViewSwitch } from "@/features/agenda/components/agenda-view-switch";
import { NewVisitButton } from "@/features/agenda/components/new-visit-dialog";
import { DateSemanticsLegend } from "@/features/agenda/components/date-semantics";
import { VisitListView } from "@/features/agenda/components/visit-list-view";
import { VisitCalendar } from "@/features/agenda/components/visit-calendar";
import { VisitHistory } from "@/features/agenda/components/visit-history";
import { RouteView } from "@/features/agenda/components/route-view";

export const metadata: Metadata = { title: "Agenda" };

const HISTORY_PAGE_SIZE = 20;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SP = Record<string, string | string[] | undefined>;
const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function AgendaPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireUser();
  const sp = await searchParams;
  const today = todayISO();
  const viewParam = str(sp.visao);
  const view: AgendaView = AGENDA_VIEWS.includes(viewParam as AgendaView) ? (viewParam as AgendaView) : "lista";

  const autoOpen = str(sp.nova) === "1";
  const cityParam = str(sp.cidade);
  const defaultCityId = cityParam && UUID.test(cityParam) ? cityParam : null;
  const dayParam = str(sp.dia);
  const defaultDate = isISODate(dayParam) ? dayParam : null;

  // Disparada sem await: roda em paralelo com a consulta da visão escolhida.
  const citiesP = listActiveCities();
  // Evita "unhandled rejection" se outra consulta falhar antes do await; o erro continua chegando no Promise.all.
  citiesP.catch(() => {});

  let cities: Awaited<typeof citiesP>;
  let content: React.ReactNode;

  if (view === "calendario") {
    const month = parseMonthParam(str(sp.mes)) ?? today.slice(0, 7);
    let visits: Awaited<ReturnType<typeof listVisitsInRange>>;
    [cities, visits] = await Promise.all([citiesP, listVisitsInRange(`${month}-01`, endOfMonthISO(`${month}-01`))]);
    content = <VisitCalendar key={month} month={month} visits={visits} today={today} />;
  } else if (view === "historico") {
    const page = Math.max(1, Number(str(sp.page)) || 1);
    const localParam = str(sp.local);
    const cityId = localParam && UUID.test(localParam) ? localParam : null;
    const statusParam = str(sp.situacao);
    const status = statusParam === "done" || statusParam === "cancelled" ? statusParam : null;
    let history: Awaited<ReturnType<typeof listVisitHistory>>;
    [cities, history] = await Promise.all([citiesP, listVisitHistory({ page, pageSize: HISTORY_PAGE_SIZE, cityId, status })]);
    const { items, total } = history;
    content = (
      <VisitHistory
        items={items}
        total={total}
        page={page}
        pageSize={HISTORY_PAGE_SIZE}
        cities={cities}
        today={today}
        filtered={Boolean(cityId || status)}
      />
    );
  } else if (view === "roteiro") {
    const dateParam = str(sp.data);
    let dates: string[];
    let visits: Awaited<ReturnType<typeof getRouteDay>>;
    let date: string;
    if (isISODate(dateParam)) {
      date = dateParam;
      [cities, dates, visits] = await Promise.all([citiesP, listRouteDates(), getRouteDay(date)]);
    } else {
      // Sem data na URL, o dia padrão depende das datas disponíveis.
      dates = await listRouteDates();
      date = dates.includes(today) ? today : (dates[0] ?? today);
      [cities, visits] = await Promise.all([citiesP, getRouteDay(date)]);
    }
    content = <RouteView key={date} date={date} dates={dates} visits={visits} today={today} />;
  } else {
    let visits: Awaited<ReturnType<typeof listUpcomingVisits>>;
    let citiesNeeding: Awaited<ReturnType<typeof listCitiesNeedingVisit>>;
    [cities, visits, citiesNeeding] = await Promise.all([citiesP, listUpcomingVisits(), listCitiesNeedingVisit()]);
    content = (
      <VisitListView
        visits={visits}
        citiesNeeding={citiesNeeding}
        today={today}
        newVisitAction={<NewVisitButton cities={cities} variant="secondary" label="Agendar visita" />}
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Agenda"
        description="Visitas às cidades, roteiro de campo e histórico de atendimentos."
        actions={
          <NewVisitButton
            key={`${autoOpen}-${defaultCityId ?? ""}-${defaultDate ?? ""}`}
            cities={cities}
            autoOpen={autoOpen}
            defaultCityId={defaultCityId}
            defaultDate={defaultDate}
            className="w-full sm:w-auto"
          />
        }
      />
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <AgendaViewSwitch value={view} />
        <DateSemanticsLegend />
      </div>
      {content}
    </>
  );
}
