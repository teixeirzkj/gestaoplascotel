"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ChevronDown, ExternalLink, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MotionItem, MotionList } from "@/components/ui/motion-list";
import { useShellUser } from "@/components/layout/app-shell";
import { formatDate, formatDateLong, formatTime, tsToBahiaDate } from "@/lib/format";
import { todayISO, addDays } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { ease } from "@/lib/motion";
import type { ActivityView } from "@/types/database";
import { activityHref, activityLabel, activityTone } from "../constants";
import { ActivityIcon } from "./activity-icon";
import { buildDiff } from "../format-data";

const toneIcon: Record<string, string> = {
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger-fg",
  warning: "bg-warning-soft text-warning",
  info: "bg-info-soft text-info",
  brand: "bg-bronze-soft text-bronze",
  neutral: "bg-white/[0.06] text-fg-muted",
  muted: "bg-white/[0.04] text-fg-subtle",
};

function dayHeading(day: string) {
  const today = todayISO();
  if (day === today) return "Hoje";
  if (day === addDays(today, -1)) return "Ontem";
  return formatDateLong(day);
}

/** Lista de auditoria agrupada por dia (America/Bahia). Somente leitura. */
export function HistoryList({ items }: { items: ActivityView[] }) {
  const groups: { day: string; items: ActivityView[] }[] = [];
  for (const a of items) {
    const day = tsToBahiaDate(a.occurred_at);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(a);
    else groups.push({ day, items: [a] });
  }

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <section key={g.day} aria-label={formatDate(g.day)}>
          <h2 className="sticky top-14 z-10 -mx-4 mb-2 flex items-baseline gap-2 bg-bg/90 px-4 py-2 backdrop-blur-sm sm:top-16 sm:mx-0 sm:px-0">
            <span className="text-[13px] font-semibold capitalize text-fg">{dayHeading(g.day)}</span>
            <span className="tabular text-[12px] text-fg-subtle">{formatDate(g.day)}</span>
            <span className="tabular ml-auto text-[12px] text-fg-subtle">
              {g.items.length} {g.items.length === 1 ? "registro" : "registros"}
            </span>
          </h2>
          <MotionList as="ul" className="overflow-hidden rounded-2xl border border-line bg-card shadow-card">
            {g.items.map((a, i) => (
              <MotionItem as="li" key={a.id} className={cn(i > 0 && "border-t border-line")}>
                <HistoryItem item={a} />
              </MotionItem>
            ))}
          </MotionList>
        </section>
      ))}
    </div>
  );
}

function HistoryItem({ item }: { item: ActivityView }) {
  const { isOwner } = useShellUser();
  const [open, setOpen] = useState(false);
  const tone = activityTone(item.action, item.entity_type);
  const href = activityHref(item, isOwner);
  const hasDetails = item.old_data !== null || item.new_data !== null;
  const detailsId = `act-${item.id}`;

  return (
    <div className="px-4 py-3.5 sm:px-5">
      <div className="flex items-start gap-3">
        <span className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", toneIcon[tone])}>
          <ActivityIcon action={item.action} entityType={item.entity_type} className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Badge tone={tone} dot={false}>
              {activityLabel(item.action, item.entity_type)}
            </Badge>
            <time dateTime={item.occurred_at} className="tabular text-[12px] text-fg-subtle">
              {formatTime(item.occurred_at)}
            </time>
          </div>
          <p className="mt-1.5 break-words text-[14px] leading-snug text-fg">{item.summary}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-fg-muted">
            <span className="inline-flex items-center gap-1">
              <UserRound className="h-3.5 w-3.5" aria-hidden />
              {item.actor_name ?? "Sistema"}
            </span>
            {item.customer_name && item.customer_id && (
              <Link href={`/clientes/${item.customer_id}`} className="truncate font-medium text-bronze hover:underline">
                {item.customer_name}
              </Link>
            )}
          </div>
        </div>
      </div>

      {(hasDetails || href) && (
        <div className="mt-2 flex flex-wrap items-center justify-end gap-1 pl-12">
          {href && !(item.customer_id && href === `/clientes/${item.customer_id}`) && (
            <Link
              href={href}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-fg-muted transition-colors hover:bg-white/5 hover:text-fg"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Abrir
            </Link>
          )}
          {hasDetails && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls={detailsId}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-fg-muted transition-colors hover:bg-white/5 hover:text-fg"
            >
              Detalhes
              <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} className="inline-flex">
                <ChevronDown className="h-4 w-4" aria-hidden />
              </motion.span>
            </button>
          )}
        </div>
      )}

      <AnimatePresence initial={false}>
        {open && hasDetails && (
          <motion.div
            id={detailsId}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.2, ease: ease.out } }}
            exit={{ opacity: 0, transition: { duration: 0.12, ease: ease.in } }}
          >
            <DiffTable oldData={item.old_data} newData={item.new_data} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DiffTable({ oldData, newData }: { oldData: unknown; newData: unknown }) {
  const rows = buildDiff(oldData, newData);
  const both = oldData !== null && newData !== null;
  if (!rows.length) {
    return <p className="mt-2 rounded-xl bg-bg-elevated px-3 py-2.5 text-[12.5px] text-fg-muted">Sem detalhes adicionais registrados.</p>;
  }
  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-line bg-bg-elevated">
      {both && (
        <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 border-b border-line px-3 py-2 text-[11.5px] font-medium uppercase tracking-[0.06em] text-fg-subtle sm:grid">
          <span>Campo</span>
          <span>Anterior</span>
          <span>Novo</span>
        </div>
      )}
      <dl className="divide-y divide-line">
        {rows.map((r) => (
          <div
            key={r.key}
            className={cn(
              "px-3 py-2 text-[13px]",
              both ? "sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] sm:gap-3" : "flex justify-between gap-4",
            )}
          >
            <dt className="text-fg-muted">{r.label}</dt>
            {both ? (
              <dd className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1.5 sm:contents">
                <span className={cn("min-w-0 break-words", r.changed ? "text-fg-subtle line-through decoration-fg-subtle/50" : "text-fg-muted")}>
                  {r.before ?? "—"}
                </span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-fg-subtle sm:hidden" aria-hidden />
                <span className={cn("min-w-0 break-words", r.changed ? "font-medium text-fg" : "text-fg-muted")}>{r.after ?? "—"}</span>
              </dd>
            ) : (
              <dd className="min-w-0 break-words text-right font-medium text-fg">{r.after ?? r.before ?? "—"}</dd>
            )}
          </div>
        ))}
      </dl>
    </div>
  );
}
