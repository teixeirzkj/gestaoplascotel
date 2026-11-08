"use client";

import Link from "next/link";
import { CalendarDays, CheckCheck, ChevronRight, MapPin } from "lucide-react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Avatar, ContactButtons, Money } from "@/components/ui/misc";
import { MotionItem, MotionList } from "@/components/ui/motion-list";
import { InstallmentActions } from "@/features/collections/components/installment-actions";
import { CUSTOMER_STATUS } from "@/lib/labels";
import { formatDate } from "@/lib/format";
import { todayISO } from "@/lib/dates";
import type { AttentionItem } from "../queries";

/**
 * Lista de clientes de "Atenção hoje".
 * `mobileLimit`: abaixo de lg, esconde (só via CSS) os itens a partir dessa posição. Sem ele, mostra todos.
 */
export function AttentionList({ items, mobileLimit }: { items: AttentionItem[]; mobileLimit?: number }) {
  return (
    <MotionList as="ul" className="divide-y divide-line">
      {items.map((item, i) => (
        <MotionItem as="li" key={item.customerId} className={mobileLimit !== undefined && i >= mobileLimit ? "max-lg:hidden" : undefined}>
          <AttentionRow item={item} />
        </MotionItem>
      ))}
    </MotionList>
  );
}

function AttentionRow({ item }: { item: AttentionItem }) {
  const today = todayISO();
  const href = `/clientes/${item.customerId}`;
  const dateLabel = item.agreedDate ? (item.agreedDate === today ? "Hoje" : formatDate(item.agreedDate)) : null;

  return (
    <div className="px-4 py-3.5 sm:px-5">
      <div className="flex items-start gap-3">
        <Avatar name={item.customerName} className="hidden xs:inline-flex" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link href={href} className="block truncate text-[15px] font-semibold text-fg hover:text-bronze">
                {item.customerName}
              </Link>
              <p className="mt-0.5 flex min-w-0 items-center gap-1 text-[12.5px] text-fg-muted">
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="truncate">{item.cityName ?? "Sem cidade"}</span>
              </p>
            </div>
            <div className="shrink-0 text-right">
              <Money value={item.pendingAmount} className="block text-[15px] font-semibold text-fg" />
              {dateLabel && (
                <span className="mt-0.5 inline-flex items-center gap-1 text-[12px] text-fg-subtle">
                  <CalendarDays className="h-3 w-3" aria-hidden />
                  <span className="tabular">{dateLabel}</span>
                </span>
              )}
            </div>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {item.financialStatus && <StatusBadge status={item.financialStatus} map={CUSTOMER_STATUS} />}
            {item.reasons.map((r) => (
              <Badge key={r.label} tone={r.tone} dot={false} className="max-w-full">
                <span className="truncate">{r.label}</span>
              </Badge>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <ContactButtons phone={item.phone} whatsapp={item.whatsapp} />
            <ButtonLink href={href} variant="ghost" size="sm" className="px-2.5">
              Abrir ficha <ChevronRight className="h-4 w-4" aria-hidden />
            </ButtonLink>
            <div className="ml-auto flex items-center gap-2">
              {item.installment ? (
                <InstallmentActions installment={item.installment} layout="compact" />
              ) : (
                item.hasPendingConfirmation && (
                  <ButtonLink href="/cobrancas?aba=confirmar" variant="secondary" size="sm">
                    <CheckCheck className="h-4 w-4" aria-hidden /> Conferir
                  </ButtonLink>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
