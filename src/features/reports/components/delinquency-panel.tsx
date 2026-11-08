"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useEnterInitial } from "@/lib/use-hydrated";
import { ChevronRight, ShieldCheck, TriangleAlert } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ContactButtons } from "@/components/ui/misc";
import { EmptyState } from "@/components/ui/states";
import { MotionItem, MotionList, SwapContent } from "@/components/ui/motion-list";
import { formatBRL, formatDate, formatPhone } from "@/lib/format";
import { listItem, stagger } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { agingOrder, type AgingRow, type OverdueRow } from "../shared";

/** Intensidade crescente por faixa (do âmbar ao vermelho), sempre com rótulo textual. */
const BUCKET_TONE: Record<number, { bar: string; ring: string; text: string }> = {
  1: { bar: "bg-warning/60", ring: "border-warning/50 bg-warning-soft", text: "text-warning" },
  2: { bar: "bg-warning", ring: "border-warning/60 bg-warning-soft", text: "text-warning" },
  3: { bar: "bg-danger/70", ring: "border-danger/50 bg-danger-soft", text: "text-danger-fg" },
  4: { bar: "bg-danger", ring: "border-danger/60 bg-danger-soft", text: "text-danger-fg" },
};

type CustomerGroup = {
  customer_id: string;
  customer_name: string;
  phone: string | null;
  whatsapp: string | null;
  city_name: string | null;
  total: number;
  maxDays: number;
  items: OverdueRow[];
};

export function DelinquencyPanel({ buckets, installments, truncated }: { buckets: AgingRow[]; installments: OverdueRow[]; truncated: boolean }) {
  const enterInitial = useEnterInitial();
  const totalAmount = buckets.reduce((a, b) => a + b.amount, 0);
  const worst = buckets.reduce<AgingRow | null>((best, b) => (b.amount > 0 && (!best || b.amount > best.amount) ? b : best), null);
  const [selected, setSelected] = useState<number | null>(worst?.sort_order ?? null);

  const groups = useMemo<CustomerGroup[]>(() => {
    if (selected === null) return [];
    const map = new Map<string, CustomerGroup>();
    for (const i of installments) {
      if (agingOrder(i.days_overdue) !== selected) continue;
      let g = map.get(i.customer_id);
      if (!g) {
        g = {
          customer_id: i.customer_id,
          customer_name: i.customer_name,
          phone: i.customer_phone,
          whatsapp: i.customer_whatsapp,
          city_name: i.city_name,
          total: 0,
          maxDays: 0,
          items: [],
        };
        map.set(i.customer_id, g);
      }
      g.total = Math.round((g.total + i.remaining) * 100) / 100;
      g.maxDays = Math.max(g.maxDays, Math.max(i.days_overdue, 1));
      g.items.push(i);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [installments, selected]);

  const current = buckets.find((b) => b.sort_order === selected);

  return (
    <Card>
      <CardHeader
        icon={<TriangleAlert className="h-4 w-4" />}
        title="Inadimplência por tempo de atraso"
        description={totalAmount > 0 ? `${formatBRL(totalAmount)} em atraso hoje · toque numa faixa para ver os clientes` : "Posição de hoje"}
      />
      <CardBody className="pt-4">
        {totalAmount <= 0 ? (
          <EmptyState
            compact
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Nenhuma parcela em atraso"
            description="Quando uma parcela vencer sem pagamento, ela aparece aqui por faixa de atraso."
          />
        ) : (
          <>
            <motion.div
              variants={stagger(0.02, 0.04)}
              initial={enterInitial}
              animate="show"
              className="grid grid-cols-2 gap-2.5 lg:grid-cols-4"
              role="group"
              aria-label="Faixas de atraso"
            >
              {buckets.map((b) => {
                const tone = BUCKET_TONE[b.sort_order] ?? BUCKET_TONE[4];
                const active = b.sort_order === selected;
                const share = totalAmount > 0 ? (b.amount / totalAmount) * 100 : 0;
                return (
                  <motion.button
                    key={b.sort_order}
                    variants={listItem}
                    type="button"
                    aria-pressed={active}
                    disabled={b.installments_count === 0}
                    onClick={() => setSelected(b.sort_order)}
                    className={cn(
                      "flex min-h-[112px] cursor-pointer flex-col rounded-xl border p-3 text-left transition-[background-color,border-color,transform] duration-150 active:scale-[0.98]",
                      "disabled:cursor-default disabled:opacity-55",
                      active ? tone.ring : "border-line bg-bg-elevated hover:border-line-strong",
                    )}
                  >
                    <span className={cn("text-[12.5px] font-medium", active ? tone.text : "text-fg-muted")}>{b.bucket}</span>
                    <span className="money mt-1.5 truncate text-[17px] font-semibold leading-tight text-fg sm:text-[19px]">{formatBRL(b.amount)}</span>
                    <span className="mt-1 text-[11.5px] text-fg-subtle">
                      {b.installments_count} parc. · {b.customers_count} cliente{b.customers_count === 1 ? "" : "s"}
                    </span>
                    <span className="mt-auto pt-2.5">
                      <span className="block h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
                        <span className={cn("block h-full rounded-full", tone.bar)} style={{ width: `${Math.max(share, b.amount > 0 ? 3 : 0)}%` }} />
                      </span>
                    </span>
                  </motion.button>
                );
              })}
            </motion.div>

            <SwapContent id={String(selected)} className="mt-5">
              {current && current.installments_count > 0 ? (
                <div>
                  <div className="mb-2 flex items-baseline justify-between gap-3">
                    <h3 className="text-[15px] font-semibold text-fg">
                      {current.bucket} <span className="font-normal text-fg-muted">· {groups.length} cliente{groups.length === 1 ? "" : "s"}</span>
                    </h3>
                    <span className="money text-sm font-semibold text-danger-fg">{formatBRL(current.amount)}</span>
                  </div>
                  {truncated && (
                    <p className="mb-2 text-[12px] text-fg-subtle">Exibindo as parcelas mais atrasadas. Exporte a inadimplência detalhada para a lista completa.</p>
                  )}
                  <MotionList as="ul" className="divide-y divide-line rounded-xl border border-line">
                    {groups.map((g) => (
                      <MotionItem as="li" key={g.customer_id} className="p-3.5">
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <Link
                              href={`/clientes/${g.customer_id}`}
                              className="group inline-flex max-w-full items-center gap-1 text-[15px] font-semibold text-fg hover:text-bronze"
                            >
                              <span className="truncate">{g.customer_name}</span>
                              <ChevronRight className="h-4 w-4 shrink-0 text-fg-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
                            </Link>
                            <p className="mt-0.5 truncate text-[12.5px] text-fg-muted">
                              {[g.city_name, g.whatsapp || g.phone ? formatPhone(g.whatsapp || g.phone) : null].filter(Boolean).join(" · ") || "Sem contato"}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="money text-[15px] font-semibold text-fg">{formatBRL(g.total)}</p>
                            <p className="text-[12px] text-danger-fg">{g.maxDays} dia{g.maxDays === 1 ? "" : "s"}</p>
                          </div>
                        </div>
                        <div className="mt-2.5 flex items-end justify-between gap-3">
                          <ul className="min-w-0 flex-1 space-y-1">
                            {g.items.map((i) => (
                              <li key={i.id} className="flex items-center justify-between gap-2 text-[12.5px]">
                                <span className="min-w-0 truncate text-fg-muted">
                                  Venda #{i.sale_code} · parc. {i.number} · venc. {formatDate(i.original_due_date)}
                                </span>
                                <span className="money shrink-0 text-fg">{formatBRL(i.remaining)}</span>
                              </li>
                            ))}
                          </ul>
                          <ContactButtons
                            phone={g.phone}
                            whatsapp={g.whatsapp}
                            size="icon"
                            message={`Olá, ${g.customer_name.split(" ")[0]}! Tudo bem? Passando para lembrar do valor em aberto de ${formatBRL(g.total)} com a Plascotel.`}
                          />
                        </div>
                      </MotionItem>
                    ))}
                  </MotionList>
                </div>
              ) : (
                <p className="py-4 text-center text-[13px] text-fg-muted">Selecione uma faixa com parcelas para ver os clientes.</p>
              )}
            </SwapContent>
          </>
        )}
      </CardBody>
    </Card>
  );
}
