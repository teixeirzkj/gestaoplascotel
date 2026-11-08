"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, Table2 } from "lucide-react";
import { EmptyState } from "@/components/ui/states";
import { Button } from "@/components/ui/button";
import { formatBRL, formatBRLCompact, formatMonthYear } from "@/lib/format";
import type { MonthlyPoint } from "../queries";

const SERIES = [
  { key: "received", label: "Recebido", color: "var(--color-bronze)", opacity: 1 },
  { key: "sold", label: "Vendido", color: "var(--color-paper)", opacity: 0.85 },
] as const;

type Row = MonthlyPoint & { label: string };

type TooltipEntry = { dataKey: string; name: string; value: number; color?: string };

export function MonthlyChartView({
  series,
  receivedMonth,
  receivable,
}: {
  series: MonthlyPoint[];
  receivedMonth: number;
  receivable: number;
}) {
  const [showTable, setShowTable] = useState(false);
  const rows: Row[] = series.map((p) => ({ ...p, label: formatMonthYear(p.month) }));
  const hasData = rows.some((r) => r.sold > 0 || r.received > 0);
  const totalReceived = rows.reduce((s, r) => s + r.received, 0);
  const totalSold = rows.reduce((s, r) => s + r.sold, 0);
  // monthly_series vem em ordem crescente: o último ponto é o mês corrente.
  const current = series[series.length - 1];

  return (
    <div className="space-y-5">
      <ReceivedVsExpected received={receivedMonth} expected={current?.due ?? 0} receivable={receivable} />

      {!hasData ? (
        <EmptyState
          compact
          icon={<BarChart3 className="h-5 w-5" />}
          title="Ainda sem movimentação"
          description="Assim que houver vendas e pagamentos confirmados, a evolução mensal aparece aqui."
        />
      ) : (
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-1" aria-label="Legenda">
              {SERIES.map((s) => (
                <li key={s.key} className="flex items-center gap-1.5 text-[12.5px] text-fg-muted">
                  <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: s.color, opacity: s.opacity }} aria-hidden />
                  {s.label}
                  <span className="money font-medium text-fg">{formatBRLCompact(s.key === "received" ? totalReceived : totalSold)}</span>
                </li>
              ))}
            </ul>
            <Button variant="ghost" size="sm" onClick={() => setShowTable((v) => !v)} aria-pressed={showTable} className="px-2.5">
              {showTable ? <BarChart3 className="h-4 w-4" aria-hidden /> : <Table2 className="h-4 w-4" aria-hidden />}
              {showTable ? "Gráfico" : "Tabela"}
            </Button>
          </div>

          {showTable ? (
            <MonthlyTable rows={rows} />
          ) : (
            <div
              className="h-[220px] w-full sm:h-[260px]"
              role="img"
              aria-label={`Gráfico de barras: recebido ${formatBRL(totalReceived)} e vendido ${formatBRL(totalSold)} nos últimos ${rows.length} meses`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barGap={2} barCategoryGap="24%">
                  <CartesianGrid vertical={false} stroke="var(--color-line)" />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "var(--color-fg-subtle)", fontSize: 12 }}
                    interval={0}
                    tickMargin={8}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={52}
                    tick={{ fill: "var(--color-fg-subtle)", fontSize: 11 }}
                    tickFormatter={(v: number) => formatBRLCompact(v).replace("R$ ", "")}
                  />
                  <Tooltip
                    cursor={{ fill: "rgb(255 255 255 / 0.04)" }}
                    content={(p) => (
                      <ChartTooltip
                        active={Boolean(p.active)}
                        label={p.label as string | number | undefined}
                        payload={(p.payload ?? []).map((e) => ({ dataKey: String(e.dataKey ?? e.name), name: String(e.name ?? ""), value: Number(e.value ?? 0), color: e.color }))}
                      />
                    )}
                  />
                  {SERIES.map((s) => (
                    <Bar
                      key={s.key}
                      dataKey={s.key}
                      name={s.label}
                      fill={s.color}
                      fillOpacity={s.opacity}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={28}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ChartTooltip({ active, payload, label }: { active: boolean; payload: TooltipEntry[]; label?: string | number }) {
  if (!active || !payload.length) return null;
  return (
    <div className="rounded-xl border border-line-strong bg-bg-elevated px-3 py-2.5 shadow-pop">
      <p className="mb-1.5 text-[12px] font-medium capitalize text-fg-muted">{label}</p>
      <ul className="space-y-1">
        {payload.map((p) => (
          <li key={String(p.dataKey)} className="flex items-center justify-between gap-4 text-[13px]">
            <span className="flex items-center gap-1.5 text-fg-muted">
              <span className="h-2 w-2 rounded-[2px]" style={{ background: p.color }} aria-hidden />
              {p.name}
            </span>
            <span className="money font-semibold text-fg">{formatBRL(Number(p.value ?? 0))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MonthlyTable({ rows }: { rows: Row[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="bg-white/[0.02] text-left text-[12px] text-fg-subtle">
            <th className="px-3 py-2 font-medium">Mês</th>
            <th className="px-3 py-2 text-right font-medium">Recebido</th>
            <th className="px-3 py-2 text-right font-medium">Previsto</th>
            <th className="px-3 py-2 text-right font-medium">Vendido</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.month} className="border-t border-line">
              <td className="px-3 py-2 capitalize text-fg-muted">{r.label}</td>
              <td className="money px-3 py-2 text-right text-fg">{formatBRL(r.received)}</td>
              <td className="money px-3 py-2 text-right text-fg-muted">{formatBRL(r.due)}</td>
              <td className="money px-3 py-2 text-right text-fg">{formatBRL(r.sold)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Barra de proporção: recebido no mês x valor das parcelas que vencem no mês (mesmo período).
 * O saldo total da carteira aparece à parte, só como referência.
 */
function ReceivedVsExpected({ received, expected, receivable }: { received: number; expected: number; receivable: number }) {
  const pct = expected > 0 ? Math.round((received / expected) * 100) : 0;
  const bar = Math.min(pct, 100);
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-fg-muted">Recebido no mês</p>
          <p className="money text-[19px] font-semibold leading-tight text-fg">{formatBRL(received)}</p>
        </div>
        <div className="min-w-0 text-right">
          <p className="text-[12px] font-medium text-fg-muted">Vence no mês</p>
          <p className="money text-[15px] font-semibold leading-tight text-fg-muted">{formatBRL(expected)}</p>
        </div>
      </div>
      <div
        className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-white/[0.06]"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={bar}
        aria-valuetext={`${pct}%`}
        aria-label={expected > 0 ? `Recebido no mês corresponde a ${pct}% do valor que vence no mês` : "Nenhuma parcela vence neste mês"}
      >
        <div className="h-full rounded-full bg-bronze" style={{ width: `${bar}%` }} />
      </div>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-[12px] text-fg-subtle">
        <p>
          {expected > 0 ? (
            <>
              <span className="tabular font-medium text-fg-muted">{pct}%</span> do previsto para o mês
            </>
          ) : (
            "Nenhuma parcela vence neste mês"
          )}
        </p>
        <p>
          Carteira a receber: <span className="money font-medium text-fg-muted">{formatBRL(receivable)}</span>
        </p>
      </div>
    </div>
  );
}
