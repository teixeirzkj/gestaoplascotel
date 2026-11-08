"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useEnterInitial } from "@/lib/use-hydrated";
import { CalendarClock, MapPin, StickyNote } from "lucide-react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Avatar, ContactButtons, Table, Td, Th } from "@/components/ui/misc";
import { formatBRL, formatDate, formatPhone } from "@/lib/format";
import { INSTALLMENT_STATUS } from "@/lib/labels";
import { listItem, stagger } from "@/lib/motion";
import { num } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { InstallmentView } from "@/types/database";
import { collectionMessage, installmentLabel } from "../messages";
import { InstallmentActions } from "./installment-actions";

/** Lista de parcelas: cards no celular, tabela a partir de md. Itens entram/saem animados. */
export function CollectionsList({ rows }: { rows: InstallmentView[] }) {
  const enterInitial = useEnterInitial();
  return (
    <>
      <motion.ul variants={stagger(0.02, 0.04)} initial={enterInitial} animate="show" className="space-y-3 md:hidden">
        <AnimatePresence initial={false} mode="popLayout">
          {rows.map((i) => (
            <motion.li key={i.id} variants={listItem} exit="exit" layout="position">
              <InstallmentCard i={i} />
            </motion.li>
          ))}
        </AnimatePresence>
      </motion.ul>

      <div className="hidden overflow-hidden rounded-2xl border border-line bg-card shadow-card md:block">
        <Table>
          <thead>
            <tr>
              <Th className="w-[34%]">Cliente</Th>
              <Th>Venda</Th>
              <Th>Cobrança</Th>
              <Th className="text-right">Valor</Th>
              <Th>Situação</Th>
              <Th className="text-right">
                <span className="sr-only">Ações</span>
              </Th>
            </tr>
          </thead>
          <motion.tbody variants={stagger(0.02, 0.03)} initial={enterInitial} animate="show">
            <AnimatePresence initial={false}>
              {rows.map((i) => (
                <InstallmentRow key={i.id} i={i} />
              ))}
            </AnimatePresence>
          </motion.tbody>
        </Table>
      </div>
    </>
  );
}

/** Badge principal "Atrasada" é redundante quando o card já mostra "N dias de atraso" em vermelho. */
function overdueShownByHint(i: InstallmentView): boolean {
  return i.status === "overdue" && i.days_overdue > 0;
}

function hasCardBadges(i: InstallmentView): boolean {
  return (
    !overdueShownByHint(i) ||
    (i.is_partial && i.status !== "paid") ||
    num(i.pending_confirmation_amount) > 0 ||
    (i.needs_visit && i.status !== "paid")
  );
}

function StatusBadges({ i, hideOverdue = false }: { i: InstallmentView; hideOverdue?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {!(hideOverdue && overdueShownByHint(i)) && <StatusBadge status={i.status} map={INSTALLMENT_STATUS} />}
      {i.is_partial && i.status !== "paid" && (
        <Badge tone="brand" dot={false}>
          Parcial
        </Badge>
      )}
      {num(i.pending_confirmation_amount) > 0 && (
        <Badge tone="warning" dot={false}>
          Aguardando confirmação
        </Badge>
      )}
      {i.needs_visit && i.status !== "paid" && (
        <Badge tone="info" dot={false}>
          <MapPin className="h-3 w-3" aria-hidden /> Visita
        </Badge>
      )}
    </div>
  );
}

function OverdueHint({ i }: { i: InstallmentView }) {
  if (i.status !== "overdue" || i.days_overdue <= 0) return null;
  return (
    <span className="tabular text-[12px] font-medium text-danger-fg">
      {i.days_overdue} dia{i.days_overdue > 1 ? "s" : ""} de atraso
    </span>
  );
}

function SaleLink({ i }: { i: InstallmentView }) {
  return (
    <Link href={`/vendas/${i.sale_id}`} className="font-medium text-fg underline-offset-4 hover:text-bronze hover:underline">
      #{i.sale_code}
    </Link>
  );
}

function InstallmentCard({ i }: { i: InstallmentView }) {
  const paid = i.status === "paid";
  const phone = i.customer_phone || i.customer_whatsapp;
  return (
    <article className="rounded-2xl border border-line bg-card p-4 shadow-card">
      <header className="flex items-start gap-3">
        <Avatar name={i.customer_name} />
        <div className="min-w-0 flex-1">
          <Link
            href={`/clientes/${i.customer_id}`}
            className="block truncate text-[15px] font-semibold leading-tight text-fg hover:text-bronze"
          >
            {i.customer_name}
          </Link>
          <p className="mt-0.5 truncate text-[12.5px] text-fg-muted">
            {i.city_name ?? "Sem cidade"}
            {phone && <span className="tabular"> · {formatPhone(phone)}</span>}
          </p>
        </div>
      </header>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-fg-muted">{paid ? "Valor pago" : "Restante"}</p>
          <p className="money text-[22px] font-semibold leading-tight tracking-tight text-fg">{formatBRL(paid ? i.amount : i.remaining)}</p>
          {!paid && num(i.remaining) !== num(i.amount) && (
            <p className="money text-[12px] text-fg-subtle">de {formatBRL(i.amount)}</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[12px] font-medium text-fg-muted">{paid ? "Pago em" : "Cobrar em"}</p>
          <p className={cn("tabular text-[15px] font-semibold", i.status === "overdue" ? "text-danger-fg" : "text-fg")}>
            {formatDate(paid ? i.paid_at : i.collection_date)}
          </p>
          <OverdueHint i={i} />
        </div>
      </div>

      {/* Vencimento original só aparece quando difere da data de cobrança (parcela adiada). */}
      <p className="mt-3 text-[12.5px] text-fg-muted">
        Venda <SaleLink i={i} /> · {installmentLabel(i.number)}
        {i.is_postponed && (
          <span className="ml-1 inline-flex items-center gap-0.5 text-info">
            <CalendarClock className="h-3 w-3" aria-hidden />
            <span className="tabular">
              adiada {i.postponed_count}x · venc. {formatDate(i.original_due_date)}
            </span>
          </span>
        )}
      </p>

      {hasCardBadges(i) && (
        <div className="mt-3">
          <StatusBadges i={i} hideOverdue />
        </div>
      )}

      {i.notes && (
        <p className="mt-2.5 flex items-start gap-1.5 text-[12.5px] leading-relaxed text-fg-muted">
          <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fg-subtle" aria-hidden />
          <span className="line-clamp-2">{i.notes}</span>
        </p>
      )}

      {!paid && (
        <div className="mt-4 flex items-center gap-2 border-t border-line pt-3">
          <div className="min-w-0 flex-1">
            {i.status !== "cancelled" && <InstallmentActions installment={i} layout="compact" />}
          </div>
          <ContactButtons phone={i.customer_phone} whatsapp={i.customer_whatsapp} message={collectionMessage(i)} size="icon" />
        </div>
      )}
    </article>
  );
}

function InstallmentRow({ i }: { i: InstallmentView }) {
  const paid = i.status === "paid";
  const phone = i.customer_phone || i.customer_whatsapp;
  return (
    <motion.tr variants={listItem} exit="exit" className="transition-colors hover:bg-white/[0.025]">
      {/* max-w-0 + largura em %: a célula ocupa ~1/3 da tabela e o `truncate` só corta quando falta espaço. */}
      <Td className="w-[34%] max-w-0 py-3">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <Link href={`/clientes/${i.customer_id}`} className="block truncate font-semibold text-fg hover:text-bronze">
              {i.customer_name}
            </Link>
            <p className="truncate text-[12px] text-fg-muted">
              {i.city_name ?? "Sem cidade"}
              {phone && <span className="tabular"> · {formatPhone(phone)}</span>}
            </p>
          </div>
          {!paid && <ContactButtons phone={i.customer_phone} whatsapp={i.customer_whatsapp} message={collectionMessage(i)} />}
        </div>
      </Td>
      <Td className="whitespace-nowrap py-3">
        <SaleLink i={i} />
        <p className="text-[12px] text-fg-muted">{installmentLabel(i.number)}</p>
      </Td>
      <Td className="whitespace-nowrap py-3">
        <p className={cn("tabular font-medium", i.status === "overdue" ? "text-danger-fg" : "text-fg")}>
          {paid ? `Pago ${formatDate(i.paid_at)}` : formatDate(i.collection_date)}
        </p>
        <p className="tabular text-[12px] text-fg-subtle">
          Venc. {formatDate(i.original_due_date)}
          {i.is_postponed && <span className="ml-1 text-info">· adiada</span>}
        </p>
        <OverdueHint i={i} />
      </Td>
      <Td className="whitespace-nowrap py-3 text-right">
        <p className="money font-semibold text-fg">{formatBRL(paid ? i.amount : i.remaining)}</p>
        {!paid && num(i.remaining) !== num(i.amount) && <p className="money text-[12px] text-fg-subtle">de {formatBRL(i.amount)}</p>}
      </Td>
      <Td className="py-3">
        <StatusBadges i={i} />
        {i.notes && (
          <p className="mt-1 max-w-[220px] truncate text-[12px] text-fg-muted" title={i.notes}>
            {i.notes}
          </p>
        )}
      </Td>
      <Td className="py-3 text-right">
        {!paid && i.status !== "cancelled" && (
          <div className="flex justify-end">
            <InstallmentActions installment={i} layout="compact" />
          </div>
        )}
      </Td>
    </motion.tr>
  );
}

