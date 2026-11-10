import Link from "next/link";
import { CalendarClock, CalendarDays, Clock, History, MapPin, UserRound, Users } from "lucide-react";
import { StatusBadge } from "@/components/ui/badge";
import { Avatar, Money } from "@/components/ui/misc";
import { EmptyState } from "@/components/ui/states";
import { CUSTOMER_STATUS, INSTALLMENT_STATUS } from "@/lib/labels";
import { formatDate, formatDateLong, formatDayMonth, formatRelativeDays, formatTime, tsToBahiaDate } from "@/lib/format";
import { diffDays, todayISO } from "@/lib/dates";
import { getCurrentUser } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { activityHref, activityLabel, activityTone } from "@/features/history/constants";
import { ActivityIcon } from "@/features/history/components/activity-icon";
import { getCustomersNeedingAttention, getRecentActivity, getUpcomingInstallments, getUpcomingVisits } from "../queries";
import { DashSection, safeLoad } from "./section";
import { SectionError } from "./section-error";

const rowCls = "group flex min-h-14 items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-white/[0.03]";

/* -------------------------------------------------------------------------- */

export async function UpcomingInstallments() {
  const res = await safeLoad(() => getUpcomingInstallments(6));
  if (!res.ok) return <SectionError title="Próximas cobranças indisponíveis" />;
  const items = res.data;
  const today = todayISO();
  return (
    <DashSection
      title="Próximas cobranças"
      description="Próximos 7 dias"
      icon={<CalendarClock className="h-4 w-4" />}
      href={items.length ? "/cobrancas?aba=proximas" : undefined}
    >
      {items.length === 0 ? (
        <EmptyState compact title="Nada nos próximos 7 dias" description="Nenhuma parcela programada para esta semana." />
      ) : (
        <ul className="-mx-2">
          {items.map((i) => {
            const days = diffDays(today, i.collection_date);
            return (
              <li key={i.id}>
                <Link href={`/clientes/${i.customer_id}`} className={rowCls}>
                  <span className="flex w-14 shrink-0 flex-col items-center rounded-lg bg-white/[0.04] py-1.5">
                    <span className="tabular text-[13px] font-semibold leading-none text-fg">{formatDayMonth(i.collection_date)}</span>
                    <span className="mt-1 whitespace-nowrap text-[10.5px] leading-none text-fg-subtle">{formatRelativeDays(days)}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-fg group-hover:text-bronze">{i.customer_name}</span>
                    <span className="block truncate text-[12px] text-fg-muted">
                      {i.city_name ?? "Sem cidade"} · {i.number === 0 ? "Entrada" : `Parcela ${i.number}`} · #{i.sale_code}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <Money value={i.remaining} className="text-[14px] font-semibold text-fg" />
                    {i.status === "postponed" && <StatusBadge status={i.status} map={INSTALLMENT_STATUS} />}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </DashSection>
  );
}

/* -------------------------------------------------------------------------- */

export async function CustomersAttention() {
  const res = await safeLoad(() => getCustomersNeedingAttention(6));
  if (!res.ok) return <SectionError title="Clientes em atenção indisponíveis" />;
  const items = res.data;
  return (
    <DashSection
      title="Clientes que precisam de atenção"
      description="Maior valor em atraso primeiro"
      icon={<Users className="h-4 w-4" />}
      href={items.length ? "/clientes?situacao=overdue" : undefined}
    >
      {items.length === 0 ? (
        <EmptyState compact title="Nenhum cliente com pendência" description="Todos os clientes estão em dia." />
      ) : (
        <ul className="-mx-2 grid grid-cols-1 gap-0.5 sm:grid-cols-2 sm:gap-x-2 lg:grid-cols-1 xl:grid-cols-2">
          {items.map((c) => (
            <li key={c.id} className="min-w-0">
              <Link href={`/clientes/${c.id}`} className={rowCls}>
                <Avatar name={c.full_name} className="h-9 w-9 text-[12px]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium text-fg group-hover:text-bronze">{c.full_name}</span>
                  <span className="mt-0.5 flex items-center gap-1.5">
                    <StatusBadge status={c.financial_status} map={CUSTOMER_STATUS} />
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <Money value={c.overdue_amount > 0 ? c.overdue_amount : c.balance} className={cn("block text-[14px] font-semibold", c.overdue_amount > 0 ? "text-danger-fg" : "text-fg")} />
                  <span className="block text-[11.5px] text-fg-subtle">{c.overdue_amount > 0 ? "em atraso" : "em aberto"}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashSection>
  );
}

/* -------------------------------------------------------------------------- */

export async function UpcomingVisits() {
  const res = await safeLoad(() => getUpcomingVisits(4));
  if (!res.ok) return <SectionError title="Próximas visitas indisponíveis" />;
  const items = res.data;
  return (
    <DashSection title="Próximas visitas" icon={<MapPin className="h-4 w-4" />} href="/agenda" hrefLabel="Agenda">
      {items.length === 0 ? (
        <EmptyState
          compact
          icon={<CalendarDays className="h-5 w-5" />}
          title="Nenhuma visita planejada"
          description="Agende a próxima passagem por uma cidade."
          action={
            <Link href="/agenda?nova=1" className="text-[13px] font-medium text-bronze hover:underline">
              Agendar visita
            </Link>
          }
        />
      ) : (
        <ul className="-mx-2">
          {items.map((v) => (
            <li key={v.id}>
              <Link href={`/agenda/${v.id}`} className={rowCls}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-info-soft text-info">
                  <MapPin className="h-[18px] w-[18px]" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium text-fg group-hover:text-bronze">{v.city_name}</span>
                  <span className="block truncate text-[12px] capitalize text-fg-muted">
                    {formatDateLong(v.visit_date)}
                    {v.visit_time ? ` · ${v.visit_time.slice(0, 5)}` : ""}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-white/[0.05] px-2 py-1 text-[12px] text-fg-muted">
                  <UserRound className="h-3.5 w-3.5" aria-hidden />
                  <span className="tabular">{v.customers_count}</span>
                  <span className="sr-only">clientes</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashSection>
  );
}

/* -------------------------------------------------------------------------- */

const toneIcon: Record<string, string> = {
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger-fg",
  warning: "bg-warning-soft text-warning",
  info: "bg-info-soft text-info",
  brand: "bg-bronze-soft text-bronze",
  neutral: "bg-white/[0.06] text-fg-muted",
  muted: "bg-white/[0.04] text-fg-subtle",
};

export async function RecentActivity() {
  const [res, user] = await Promise.all([safeLoad(() => getRecentActivity(8)), getCurrentUser()]);
  if (!res.ok) return <SectionError title="Últimas movimentações indisponíveis" />;
  const items = res.data;
  const today = todayISO();
  return (
    <DashSection title="Últimas movimentações" icon={<History className="h-4 w-4" />} href="/historico" hrefLabel="Histórico">
      {items.length === 0 ? (
        <EmptyState compact title="Sem movimentações ainda" description="Vendas, pagamentos e adiamentos aparecerão aqui." />
      ) : (
        <ol className="relative">
          {items.map((a, idx) => {
            const href = activityHref(a, Boolean(user?.isOwner));
            const day = tsToBahiaDate(a.occurred_at);
            const when = day === today ? formatTime(a.occurred_at) : `${formatDate(day).slice(0, 5)} ${formatTime(a.occurred_at)}`;
            const content = (
              <>
                <span className={cn("relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", toneIcon[activityTone(a.action, a.entity_type)])}>
                  <ActivityIcon action={a.action} entityType={a.entity_type} className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-[13.5px] leading-snug text-fg">{a.summary}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[12px] text-fg-subtle">
                    <span className="font-medium text-fg-muted">{activityLabel(a.action, a.entity_type)}</span>
                    <span aria-hidden>·</span>
                    <span>{a.actor_name ?? "Sistema"}</span>
                    {a.customer_name && (
                      <>
                        <span aria-hidden>·</span>
                        <span className="truncate">{a.customer_name}</span>
                      </>
                    )}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1 text-[12px] text-fg-subtle">
                  <Clock className="h-3 w-3" aria-hidden />
                  <time dateTime={a.occurred_at} className="tabular">
                    {when}
                  </time>
                </span>
              </>
            );
            return (
              <li key={a.id} className="relative">
                {idx < items.length - 1 && <span className="absolute bottom-0 left-[15px] top-10 w-px bg-line" aria-hidden />}
                {href ? (
                  <Link href={href} className="flex items-start gap-3 rounded-xl py-2 transition-colors hover:bg-white/[0.03]">
                    {content}
                  </Link>
                ) : (
                  <div className="flex items-start gap-3 py-2">{content}</div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </DashSection>
  );
}
