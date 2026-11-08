"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { BarChart3 } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Segmented } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/states";
import { SwapContent } from "@/components/ui/motion-list";
import { Table, Td, Th, Tr } from "@/components/ui/misc";
import { formatBRL, formatMonthYear } from "@/lib/format";
import type { MonthPoint } from "../shared";

const MonthlyChartCanvas = dynamic(() => import("./monthly-chart-canvas"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-xl" />,
});

const LEGEND = [
  { key: "sold", label: "Vendido", swatch: "h-2.5 w-2.5 rounded-[3px] bg-bronze" },
  { key: "received", label: "Recebido", swatch: "h-2.5 w-2.5 rounded-[3px] bg-success" },
  { key: "due", label: "Vencido no mês", swatch: "h-0 w-4 border-t-2 border-dashed border-fg-subtle" },
] as const;

type View = "chart" | "table";

export function MonthlyChart({ data }: { data: MonthPoint[] }) {
  const [view, setView] = useState<View>("chart");
  const hasData = data.some((d) => d.sold || d.received || d.due);
  const totals = data.reduce((a, d) => ({ sold: a.sold + d.sold, received: a.received + d.received, due: a.due + d.due }), { sold: 0, received: 0, due: 0 });

  return (
    <Card>
      <CardHeader
        icon={<BarChart3 className="h-4 w-4" />}
        title="Evolução mensal"
        description="Últimos 12 meses · vendido, recebido e parcelas que venceram"
        action={
          hasData ? (
            <Segmented<View>
              options={[
                { value: "chart", label: "Gráfico" },
                { value: "table", label: "Tabela" },
              ]}
              value={view}
              onChange={setView}
              className="mx-0 px-0"
            />
          ) : undefined
        }
      />
      <CardBody className="pt-4">
        {!hasData ? (
          <p className="py-6 text-center text-[13px] text-fg-muted">Ainda não há vendas, recebimentos ou vencimentos nos últimos 12 meses.</p>
        ) : (
          <SwapContent id={view}>
            {view === "chart" ? (
              <>
                <ul className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px]" aria-label="Legenda">
                  {LEGEND.map((l) => (
                    <li key={l.key} className="flex items-center gap-2 text-fg-muted">
                      <span className={l.swatch} aria-hidden />
                      {l.label}
                      <span className="money text-fg">{formatBRL(totals[l.key])}</span>
                    </li>
                  ))}
                </ul>
                <div className="h-[240px] w-full sm:h-[300px]" role="img" aria-label="Gráfico mensal de vendido, recebido e vencido. Use a visão Tabela para os valores.">
                  <MonthlyChartCanvas data={data} />
                </div>
              </>
            ) : (
              <div className="-mx-4 sm:-mx-5">
                <Table>
                  <thead>
                    <tr>
                      <Th>Mês</Th>
                      <Th className="text-right">Vendido</Th>
                      <Th className="text-right">Recebido</Th>
                      <Th className="text-right">Vencido</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...data].reverse().map((d) => (
                      <Tr key={d.month}>
                        <Td className="h-11 whitespace-nowrap capitalize text-fg-muted">{formatMonthYear(d.month)}</Td>
                        <Td className="money h-11 text-right">{formatBRL(d.sold)}</Td>
                        <Td className="money h-11 text-right text-success">{formatBRL(d.received)}</Td>
                        <Td className="money h-11 text-right text-fg-muted">{formatBRL(d.due)}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </SwapContent>
        )}
      </CardBody>
    </Card>
  );
}

export function MonthlyChartSkeleton() {
  return (
    <div className="rounded-2xl border border-line bg-card p-4 sm:p-5" role="status" aria-label="Carregando gráfico">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="mt-2 h-4 w-64 max-w-full" />
      <Skeleton className="mt-5 h-[240px] w-full rounded-xl sm:h-[300px]" />
    </div>
  );
}
