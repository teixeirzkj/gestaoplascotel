"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowDown, ArrowUp, CalendarPlus, ChevronRight, ClipboardCheck, Clock, Home, Navigation, Route as RouteIcon, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { ContactButtons, Money } from "@/components/ui/misc";
import { EmptyState } from "@/components/ui/states";
import { MotionItem, MotionList } from "@/components/ui/motion-list";
import { useUrlParams } from "@/components/ui/url-controls";
import { VISIT_CUSTOMER_STATUS, VISIT_STATUS } from "@/lib/labels";
import { formatDate } from "@/lib/format";
import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { reorderStopsAction } from "../actions";
import { buildRouteStops, moveStop, type RouteStop } from "../route";
import { formatDateTitle, formatVisitTime, mapsSearchLink, relativeDayLabel, weekdayShort } from "../utils";
import type { RouteVisit } from "../types";
import { RouteMapPlaceholder } from "./route-map-placeholder";
import { VisitProgress } from "./visit-progress";

function stopsFor(visit: RouteVisit): RouteStop[] {
  return buildRouteStops(
    visit.customers.map((c) => ({
      visitCustomerId: c.id,
      customerId: c.customerId,
      stopOrder: c.stopOrder,
      status: c.status,
      notes: c.notes,
      fullName: c.fullName,
      phone: c.phone,
      whatsapp: c.whatsapp,
      neighborhood: c.neighborhood,
      address: c.address,
      reference: c.reference,
      latitude: c.latitude,
      longitude: c.longitude,
    })),
    { latitude: visit.cityLatitude, longitude: visit.cityLongitude },
  );
}

function RouteVisitBlock({ visit, stops, startIndex }: { visit: RouteVisit; stops: RouteStop[]; startIndex: number }) {
  const router = useRouter();
  const [order, setOrder] = useState(() => stops.map((s) => s.id));
  const [pending, startTransition] = useTransition();
  const byId = useMemo(() => new Map(stops.map((s) => [s.id, s])), [stops]);
  const balances = useMemo(() => new Map(visit.customers.map((c) => [c.id, c])), [visit.customers]);
  const time = formatVisitTime(visit.visitTime);
  const attended = visit.customers.filter((c) => c.status !== "to_visit").length;
  const editable = visit.status === "planned";

  function move(id: string, dir: -1 | 1) {
    const prev = order;
    const next = moveStop(order, id, dir);
    if (next === prev) return;
    setOrder(next);
    startTransition(async () => {
      const r = await reorderStopsAction({ visitId: visit.id, orderedIds: next });
      if (!r.ok) {
        setOrder(prev);
        toast.error(r.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="min-w-0">
      <Card className="mb-3 p-4 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[17px] font-semibold tracking-tight text-fg">
                {visit.cityName}
                <span className="ml-1 text-[13px] font-medium text-fg-subtle">{visit.cityState}</span>
              </h3>
              <StatusBadge status={visit.status} map={VISIT_STATUS} />
            </div>
            <p className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-fg-muted">
              <Clock className="h-3.5 w-3.5" aria-hidden /> {time ?? "Sem horário"} · {stops.length} {stops.length === 1 ? "parada" : "paradas"}
            </p>
          </div>
          <ButtonLink href={`/agenda/${visit.id}`} variant="secondary" size="sm" aria-label={`Abrir visita de ${visit.cityName}`}>
            Abrir <ChevronRight className="h-4 w-4" />
          </ButtonLink>
        </div>
        {visit.notes && (
          <p className="mt-2 flex items-start gap-1.5 text-[12.5px] text-fg-muted">
            <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> {visit.notes}
          </p>
        )}
        {stops.length > 0 && <VisitProgress attended={attended} total={stops.length} className="mt-3" size="sm" />}
      </Card>

      {stops.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-5 text-center text-[13px] text-fg-subtle">
          Nenhum cliente nesta visita. <Link href={`/agenda/${visit.id}`} className="font-medium text-bronze">Adicionar clientes</Link>
        </p>
      ) : (
        <ol className="relative space-y-2.5" aria-busy={pending || undefined}>
          {order.map((id, idx) => {
            const s = byId.get(id);
            if (!s) return null;
            const extra = balances.get(id);
            const maps = mapsSearchLink({
              lat: s.coords && !s.approximate ? s.coords.lat : null,
              lng: s.coords && !s.approximate ? s.coords.lng : null,
              address: s.address,
              neighborhood: s.neighborhood,
              city: visit.cityName,
              state: visit.cityState,
            });
            const done = s.status !== "to_visit";
            return (
              <motion.li key={id} layout transition={spring} className="rounded-2xl border border-line bg-card shadow-card">
                <div className="flex gap-3 p-3.5 sm:p-4">
                  <div className="flex flex-col items-center gap-1.5">
                    <span
                      className={cn(
                        "tabular flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[14px] font-semibold",
                        done ? "bg-success-soft text-success" : "bg-paper text-paper-ink",
                      )}
                      aria-label={`Parada ${startIndex + idx + 1}`}
                    >
                      {startIndex + idx + 1}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Link href={`/clientes/${s.customerId}`} className="text-[15px] font-semibold text-fg hover:text-bronze">
                        {s.name}
                      </Link>
                      <StatusBadge status={s.status} map={VISIT_CUSTOMER_STATUS} className="h-5 px-2 text-[11px]" />
                    </div>
                    {(s.address || s.neighborhood) && (
                      <p className="mt-1 flex items-start gap-1.5 text-[13px] text-fg">
                        <Home className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fg-subtle" aria-hidden />
                        <span>
                          {s.address}
                          {s.address && s.neighborhood && " · "}
                          {s.neighborhood && <span className="font-medium">{s.neighborhood}</span>}
                        </span>
                      </p>
                    )}
                    {s.reference && (
                      <p className="mt-0.5 flex items-start gap-1.5 text-[12.5px] text-fg-muted">
                        <Navigation className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fg-subtle" aria-hidden />
                        <span>{s.reference}</span>
                      </p>
                    )}
                    {extra && extra.balance > 0 && (
                      <p className="mt-1 text-[12px] text-fg-subtle">
                        Saldo <Money value={extra.balance} className="font-semibold text-fg" />
                        {extra.overdueAmount > 0 && (
                          <>
                            {" "}· atraso <Money value={extra.overdueAmount} className="font-semibold text-danger" />
                          </>
                        )}
                      </p>
                    )}
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <ContactButtons phone={s.phone} whatsapp={s.whatsapp} size="icon" />
                      {maps && (
                        <a
                          href={maps}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-line px-3 text-[13px] font-medium text-fg-muted transition-colors hover:bg-white/5 hover:text-fg"
                        >
                          <RouteIcon className="h-4 w-4" /> Abrir no mapa
                        </a>
                      )}
                      <Link
                        href={`/agenda/${visit.id}#c-${s.id}`}
                        className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-line px-3 text-[13px] font-medium text-bronze transition-colors hover:bg-bronze-soft"
                      >
                        <ClipboardCheck className="h-4 w-4" /> Registrar
                      </Link>
                    </div>
                  </div>
                  {editable && order.length > 1 && (
                    <div className="flex flex-col gap-1.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => move(id, -1)}
                        disabled={idx === 0 || pending}
                        aria-label={`Subir ${s.name} na rota`}
                        className="border border-line"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => move(id, 1)}
                        disabled={idx === order.length - 1 || pending}
                        aria-label={`Descer ${s.name} na rota`}
                        className="border border-line"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </motion.li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export function RouteView({
  date,
  dates,
  visits,
  today,
}: {
  date: string;
  dates: string[];
  visits: RouteVisit[];
  today: string;
}) {
  const { set, pending } = useUrlParams();
  const blocks = useMemo(() => {
    const withStops = visits.map((v) => ({ visit: v, stops: stopsFor(v) }));
    // Numeração contínua das paradas ao longo do dia
    const starts = withStops.reduce<number[]>((acc, b, i) => [...acc, i === 0 ? 0 : acc[i - 1] + withStops[i - 1].stops.length], []);
    return withStops.map((b, i) => ({ ...b, startIndex: starts[i] }));
  }, [visits]);
  const allStops = blocks.flatMap((b) => b.stops);
  const center = blocks.find((b) => b.visit.cityLatitude != null && b.visit.cityLongitude != null)?.visit;
  const chipDates = Array.from(new Set([today, ...dates])).sort();

  return (
    <div className={cn("space-y-4 transition-opacity", pending && "opacity-60")}>
      <Card className="p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-medium text-fg-muted">Roteiro de</p>
            <p className="text-[18px] font-semibold tracking-tight text-fg">
              {date === today ? "Hoje" : formatDateTitle(date)}
              <span className="tabular ml-2 text-[13px] font-normal normal-case text-fg-subtle">
                {formatDate(date)}
                {date !== today && ` · ${relativeDayLabel(date, today)}`}
              </span>
            </p>
          </div>
          <Input
            type="date"
            value={date}
            onChange={(e) => e.target.value && set({ data: e.target.value }, { resetPage: false })}
            aria-label="Escolher data do roteiro"
            className="tabular sm:w-44"
          />
        </div>
        {chipDates.length > 1 && (
          <div className="relative -mx-3 mt-3 overflow-x-auto px-3 sm:-mx-4 sm:px-4">
            <div className="flex gap-2 pb-0.5">
              {chipDates.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => set({ data: d }, { resetPage: false })}
                  aria-pressed={d === date}
                  className={cn(
                    "flex h-11 shrink-0 cursor-pointer flex-col items-center justify-center rounded-xl border px-3 text-[12px] leading-tight transition-colors",
                    d === date ? "border-transparent bg-paper text-paper-ink" : "border-line text-fg-muted hover:border-line-strong hover:text-fg",
                  )}
                >
                  <span className="font-semibold capitalize">{d === today ? "Hoje" : weekdayShort(d)}</span>
                  <span className="tabular">{formatDate(d).slice(0, 5)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>

      {visits.length === 0 ? (
        <Card>
          <EmptyState
            icon={<RouteIcon className="h-5 w-5" />}
            title="Nenhuma visita nesta data"
            description={dates.length ? "Escolha uma das próximas datas com visitas acima ou agende uma nova visita." : "Agende uma visita para montar o roteiro de campo."}
            action={
              <ButtonLink href={`/agenda?visao=roteiro&data=${date}&nova=1&dia=${date}`} variant="secondary" size="sm" scroll={false}>
                <CalendarPlus className="h-4 w-4" /> Agendar visita
              </ButtonLink>
            }
          />
        </Card>
      ) : (
        <>
          <RouteMapPlaceholder
            stops={allStops}
            center={center ? { lat: Number(center.cityLatitude), lng: Number(center.cityLongitude) } : null}
          />
          <MotionList className="space-y-6">
            {blocks.map((b) => (
              <MotionItem key={`${b.visit.id}:${b.stops.map((s) => s.id).join(",")}`}>
                <RouteVisitBlock visit={b.visit} stops={b.stops} startIndex={b.startIndex} />
              </MotionItem>
            ))}
          </MotionList>
        </>
      )}
    </div>
  );
}
