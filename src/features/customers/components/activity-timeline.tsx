"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Ban,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  FileText,
  Handshake,
  History,
  MapPin,
  NotebookPen,
  PencilLine,
  Receipt,
  RotateCcw,
  ShoppingBag,
  UserPlus,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { formatDateLong, formatTime, tsToBahiaDate } from "@/lib/format";
import { addDays, todayISO } from "@/lib/dates";
import { listItem, stagger } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { ActivityView } from "@/types/database";
import { loadCustomerActivityAction } from "../actions";
import { ACTIVITY_PAGE_SIZE } from "../schemas";

type Meta = { icon: LucideIcon; cls: string };

const ACTION_META: Record<string, Meta> = {
  create: { icon: UserPlus, cls: "bg-bronze-soft text-bronze" },
  update: { icon: PencilLine, cls: "bg-white/[0.06] text-fg-muted" },
  sale: { icon: ShoppingBag, cls: "bg-bronze-soft text-bronze" },
  sale_paid: { icon: BadgeCheck, cls: "bg-success-soft text-success" },
  sale_reopened: { icon: RotateCcw, cls: "bg-warning-soft text-warning" },
  sale_cancelled: { icon: Ban, cls: "bg-danger-soft text-danger-fg" },
  payment: { icon: CircleDollarSign, cls: "bg-success-soft text-success" },
  payment_partial: { icon: CircleDollarSign, cls: "bg-success-soft text-success" },
  payment_pending: { icon: Clock, cls: "bg-warning-soft text-warning" },
  payment_rejected: { icon: XCircle, cls: "bg-white/[0.06] text-fg-muted" },
  payment_reversed: { icon: RotateCcw, cls: "bg-danger-soft text-danger-fg" },
  installment_paid: { icon: CheckCircle2, cls: "bg-success-soft text-success" },
  postponement: { icon: CalendarClock, cls: "bg-info-soft text-info" },
  promise: { icon: Handshake, cls: "bg-warning-soft text-warning" },
  promise_kept: { icon: Handshake, cls: "bg-success-soft text-success" },
  promise_broken: { icon: Handshake, cls: "bg-danger-soft text-danger-fg" },
  promise_cancelled: { icon: Handshake, cls: "bg-white/[0.06] text-fg-muted" },
  note: { icon: NotebookPen, cls: "bg-bronze-soft text-bronze" },
  receipt: { icon: Receipt, cls: "bg-info-soft text-info" },
  visit: { icon: MapPin, cls: "bg-info-soft text-info" },
};
const FALLBACK: Meta = { icon: FileText, cls: "bg-white/[0.06] text-fg-muted" };

function dayLabel(day: string) {
  const today = todayISO();
  if (day === today) return "Hoje";
  if (day === addDays(today, -1)) return "Ontem";
  const label = formatDateLong(day);
  return day.slice(0, 4) === today.slice(0, 4) ? label : `${label} de ${day.slice(0, 4)}`;
}

/** Uma linha da linha do tempo (ícone por tipo, resumo, hora e autor). */
export function ActivityRow({ item, showDate }: { item: ActivityView; showDate?: boolean }) {
  const meta = ACTION_META[item.action] ?? FALLBACK;
  const Icon = meta.icon;
  return (
    <div className="flex gap-3">
      <span className={cn("relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-card", meta.cls)}>
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 pb-4">
        <p className="break-words text-[13.5px] leading-snug text-fg">{item.summary}</p>
        <p className="mt-0.5 text-[12px] text-fg-subtle">
          <span className="tabular">{showDate ? `${dayLabel(tsToBahiaDate(item.occurred_at))}, ` : ""}{formatTime(item.occurred_at)}</span>
          {item.actor_name ? ` · ${item.actor_name}` : " · Sistema"}
        </p>
      </div>
    </div>
  );
}

/** Lista simples (sem agrupamento), usada no resumo da visão geral. */
export function ActivityMiniList({ items }: { items: ActivityView[] }) {
  return (
    <motion.ol variants={stagger(0.02, 0.04)} initial="hidden" animate="show" className="relative">
      <span className="absolute bottom-4 left-4 top-2 w-px bg-line" aria-hidden />
      {items.map((a) => (
        <motion.li key={a.id} variants={listItem}>
          <ActivityRow item={a} showDate />
        </motion.li>
      ))}
    </motion.ol>
  );
}

/** Linha do tempo completa, agrupada por dia, com "carregar mais". */
export function ActivityTimeline({ customerId, initial }: { customerId: string; initial: ActivityView[] }) {
  const [items, setItems] = useState(initial);
  const [hasMore, setHasMore] = useState(initial.length === ACTIVITY_PAGE_SIZE);
  const [loading, setLoading] = useState(false);

  async function loadMore() {
    setLoading(true);
    const r = await loadCustomerActivityAction({ customerId, offset: items.length });
    setLoading(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    setItems((prev) => {
      const seen = new Set(prev.map((p) => p.id));
      return [...prev, ...r.data.filter((d) => !seen.has(d.id))];
    });
    setHasMore(r.data.length === ACTIVITY_PAGE_SIZE);
  }

  if (items.length === 0) {
    return (
      <EmptyState
        compact
        icon={<History className="h-5 w-5" />}
        title="Nenhuma atividade registrada"
        description="Cadastros, vendas, pagamentos, adiamentos e observações aparecem aqui automaticamente."
      />
    );
  }

  const groups: { day: string; items: ActivityView[] }[] = [];
  for (const it of items) {
    const day = tsToBahiaDate(it.occurred_at);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(it);
    else groups.push({ day, items: [it] });
  }

  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <section key={g.day} aria-label={dayLabel(g.day)}>
          <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-muted first-letter:uppercase">{dayLabel(g.day)}</h3>
          <motion.ol variants={stagger(0.02, 0.035)} initial="hidden" animate="show" className="relative">
            <span className="absolute bottom-4 left-4 top-2 w-px bg-line" aria-hidden />
              {g.items.map((a) => (
                <motion.li key={a.id} variants={listItem}>
                  <ActivityRow item={a} />
                </motion.li>
              ))}
          </motion.ol>
        </section>
      ))}
      {hasMore && (
        <div className="flex justify-center pt-1">
          <Button variant="secondary" onClick={loadMore} loading={loading} className="w-full sm:w-auto">
            Carregar mais
          </Button>
        </div>
      )}
    </div>
  );
}
