"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useEnterInitial } from "@/lib/use-hydrated";
import { StickyNote, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, Table, Td, Th } from "@/components/ui/misc";
import { formatBRL, formatDate, formatDateTime } from "@/lib/format";
import { methodLabel } from "@/lib/labels";
import { listItem, stagger } from "@/lib/motion";
import type { PaymentView } from "@/types/database";
import { installmentLabel } from "../messages";
import { PaymentStatusActions } from "./payment-status-actions";

/** Pagamentos aguardando confirmação: cards no celular, tabela a partir de md. */
export function PendingPaymentsList({ rows }: { rows: PaymentView[] }) {
  const enterInitial = useEnterInitial();
  return (
    <>
      <motion.ul variants={stagger(0.02, 0.04)} initial={enterInitial} animate="show" className="space-y-3 md:hidden">
        <AnimatePresence initial={false} mode="popLayout">
          {rows.map((p) => (
            <motion.li key={p.id} variants={listItem} exit="exit" layout="position">
              <PaymentCard p={p} />
            </motion.li>
          ))}
        </AnimatePresence>
      </motion.ul>

      <div className="hidden overflow-hidden rounded-2xl border border-line bg-card shadow-card md:block">
        <Table>
          <thead>
            <tr>
              <Th>Cliente</Th>
              <Th>Venda</Th>
              <Th>Pago em</Th>
              <Th className="text-right">Valor</Th>
              <Th>Registro</Th>
              <Th className="text-right">
                <span className="sr-only">Ações</span>
              </Th>
            </tr>
          </thead>
          <motion.tbody variants={stagger(0.02, 0.03)} initial={enterInitial} animate="show">
            <AnimatePresence initial={false}>
              {rows.map((p) => (
                <motion.tr key={p.id} variants={listItem} exit="exit" className="transition-colors hover:bg-white/[0.025]">
                  <Td className="max-w-[220px] py-3">
                    <Link href={`/clientes/${p.customer_id}`} className="block truncate font-semibold text-fg hover:text-bronze">
                      {p.customer_name}
                    </Link>
                    <p className="truncate text-[12px] text-fg-muted">{p.city_name ?? "Sem cidade"}</p>
                  </Td>
                  <Td className="whitespace-nowrap py-3">
                    <Link href={`/vendas/${p.sale_id}`} className="font-medium text-fg underline-offset-4 hover:text-bronze hover:underline">
                      #{p.sale_code}
                    </Link>
                    <p className="text-[12px] text-fg-muted">{installmentLabel(p.installment_number)}</p>
                  </Td>
                  <Td className="whitespace-nowrap py-3">
                    <p className="tabular text-fg">{formatDate(p.paid_on)}</p>
                    <p className="text-[12px] text-fg-muted">{methodLabel(p.method)}</p>
                  </Td>
                  <Td className="whitespace-nowrap py-3 text-right">
                    <span className="money font-semibold text-fg">{formatBRL(p.amount)}</span>
                  </Td>
                  <Td className="py-3">
                    <p className="whitespace-nowrap text-[12.5px] text-fg">{p.created_by_name ?? "—"}</p>
                    <p className="tabular whitespace-nowrap text-[12px] text-fg-subtle">{formatDateTime(p.created_at)}</p>
                    {p.notes && (
                      <p className="mt-0.5 max-w-[200px] truncate text-[12px] text-fg-muted" title={p.notes}>
                        {p.notes}
                      </p>
                    )}
                  </Td>
                  <Td className="py-3">
                    <div className="flex justify-end">
                      <PaymentStatusActions payment={p} />
                    </div>
                  </Td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </motion.tbody>
        </Table>
      </div>
    </>
  );
}

function PaymentCard({ p }: { p: PaymentView }) {
  return (
    <article className="rounded-2xl border border-warning/25 bg-card p-4 shadow-card">
      <header className="flex items-start gap-3">
        <Avatar name={p.customer_name} />
        <div className="min-w-0 flex-1">
          <Link href={`/clientes/${p.customer_id}`} className="block truncate text-[15px] font-semibold leading-tight text-fg hover:text-bronze">
            {p.customer_name}
          </Link>
          <p className="mt-0.5 truncate text-[12.5px] text-fg-muted">
            {p.city_name ?? "Sem cidade"} ·{" "}
            <Link href={`/vendas/${p.sale_id}`} className="text-fg hover:text-bronze">
              #{p.sale_code}
            </Link>{" "}
            · {installmentLabel(p.installment_number)}
          </p>
        </div>
        <Badge tone="warning">A confirmar</Badge>
      </header>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[12px] font-medium text-fg-muted">Valor informado</p>
          <p className="money text-[22px] font-semibold leading-tight tracking-tight text-fg">{formatBRL(p.amount)}</p>
        </div>
        <div className="text-right">
          <p className="text-[12px] font-medium text-fg-muted">{methodLabel(p.method)}</p>
          <p className="tabular text-[15px] font-semibold text-fg">{formatDate(p.paid_on)}</p>
        </div>
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-[12px] text-fg-subtle">
        <UserRound className="h-3.5 w-3.5" aria-hidden />
        Registrado por {p.created_by_name ?? "—"} em <span className="tabular">{formatDateTime(p.created_at)}</span>
      </p>
      {p.notes && (
        <p className="mt-1.5 flex items-start gap-1.5 text-[12.5px] leading-relaxed text-fg-muted">
          <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fg-subtle" aria-hidden />
          <span className="line-clamp-2">{p.notes}</span>
        </p>
      )}

      <div className="mt-4 border-t border-line pt-3">
        <PaymentStatusActions payment={p} />
      </div>
    </article>
  );
}
