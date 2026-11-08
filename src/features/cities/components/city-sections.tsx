"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronRight, Home, MapPinned, Navigation } from "lucide-react";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ContactButtons, Money } from "@/components/ui/misc";
import { MotionItem, MotionList } from "@/components/ui/motion-list";
import { CUSTOMER_STATUS, VISIT_STATUS } from "@/lib/labels";
import { formatDate, formatDateLong } from "@/lib/format";
import { listItem } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { formatVisitTime, relativeDayLabel } from "@/features/agenda/utils";
import { TypedDate } from "@/features/agenda/components/date-semantics";
import type { CityCustomer, CityToVisit, CityVisit } from "../queries";

/** Motivos vindos de customers_to_visit ("Em atraso: R$ … · Pagamento adiado") viram chips. */
export function ReasonChips({ reason, className }: { reason: string; className?: string }) {
  const parts = reason.split(" · ").filter(Boolean);
  if (!parts.length) return null;
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {parts.map((p) => {
        const danger = p.startsWith("Em atraso") || p.startsWith("Promessa");
        return (
          <span
            key={p}
            className={cn(
              "inline-flex min-h-6 items-center rounded-full px-2.5 py-0.5 text-[11.5px] font-medium",
              danger ? "bg-danger-soft text-danger" : "bg-bronze-soft text-bronze",
            )}
          >
            {p}
          </span>
        );
      })}
    </div>
  );
}

export function ToVisitList({ items }: { items: CityToVisit[] }) {
  return (
    <MotionList as="ul" className="divide-y divide-line">
      {items.map((c) => (
        <MotionItem as="li" key={c.customerId} className="px-4 py-3.5 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link href={`/clientes/${c.customerId}`} className="text-[14.5px] font-semibold text-fg hover:text-bronze">
                {c.fullName}
              </Link>
              {(c.neighborhood || c.address) && (
                <p className="mt-0.5 flex items-start gap-1 text-[12.5px] text-fg-muted">
                  <Home className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>{[c.address, c.neighborhood].filter(Boolean).join(" · ")}</span>
                </p>
              )}
              {c.reference && (
                <p className="mt-0.5 flex items-start gap-1 text-[12.5px] text-fg-subtle">
                  <Navigation className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>{c.reference}</span>
                </p>
              )}
            </div>
            <ContactButtons phone={c.phone} whatsapp={c.phone} size="icon" />
          </div>
          <div className="mt-2.5 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
            <ReasonChips reason={c.reason} />
            <div className="ml-auto flex items-baseline gap-3 text-right">
              {c.overdueAmount > 0 && (
                <span className="text-[12px] text-fg-subtle">
                  atraso <Money value={c.overdueAmount} className="font-semibold text-danger" />
                </span>
              )}
              <span className="text-[12px] text-fg-subtle">
                saldo <Money value={c.balance} className="text-[14px] font-semibold text-fg" />
              </span>
            </div>
          </div>
          {c.nextCollectionDate && <TypedDate kind="collection" date={c.nextCollectionDate} className="mt-2" />}
        </MotionItem>
      ))}
    </MotionList>
  );
}

const INITIAL_CUSTOMERS = 12;

export function CityCustomersList({ items }: { items: CityCustomer[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? items : items.slice(0, INITIAL_CUSTOMERS);
  return (
    <>
      <ul className="divide-y divide-line">
        <AnimatePresence initial={false}>
          {visible.map((c) => (
            <motion.li key={c.id} variants={listItem} initial="hidden" animate="show" exit="exit">
              <Link
                href={`/clientes/${c.id}`}
                className="flex min-h-14 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/[0.025] sm:px-5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium text-fg">{c.fullName}</p>
                  <p className="truncate text-[12px] text-fg-subtle">{c.neighborhood || "Bairro não informado"}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Money value={c.balance} className={cn("text-[13.5px] font-semibold", c.balance > 0 ? "text-fg" : "text-fg-subtle")} />
                  <StatusBadge status={c.financialStatus} map={CUSTOMER_STATUS} className="h-5 px-2 text-[11px]" />
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-fg-subtle" aria-hidden />
              </Link>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {items.length > INITIAL_CUSTOMERS && (
        <div className="border-t border-line p-2">
          <Button variant="ghost" className="w-full" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>
            <ChevronDown className={cn("h-4 w-4 transition-transform", showAll && "rotate-180")} />
            {showAll ? "Mostrar menos" : `Mostrar todos (${items.length})`}
          </Button>
        </div>
      )}
    </>
  );
}

export function CityVisitsList({ items, today, empty }: { items: CityVisit[]; today: string; empty: string }) {
  if (!items.length) return <p className="px-4 pb-4 text-[13px] text-fg-subtle sm:px-5">{empty}</p>;
  return (
    <ul className="divide-y divide-line">
      {items.map((v) => {
        const time = formatVisitTime(v.visitTime);
        return (
          <li key={v.id}>
            <Link href={`/agenda/${v.id}`} className="flex min-h-14 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/[0.025] sm:px-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-bronze-soft text-bronze">
                <MapPinned className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-medium capitalize text-fg">
                  {formatDateLong(v.visitDate)}
                  {time && <span className="ml-1 normal-case text-fg-muted">· {time}</span>}
                </p>
                <p className="tabular text-[12px] text-fg-subtle">
                  {formatDate(v.visitDate)} · {relativeDayLabel(v.visitDate, today)} · {v.attended}/{v.total} atendidos
                </p>
              </div>
              <StatusBadge status={v.status} map={VISIT_STATUS} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
