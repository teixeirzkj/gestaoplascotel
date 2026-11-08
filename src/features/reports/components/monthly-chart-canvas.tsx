"use client";

import { useSyncExternalStore } from "react";
import { useReducedMotion } from "framer-motion";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatBRL, formatBRLCompact, formatMonthYear } from "@/lib/format";
import type { MonthPoint } from "../shared";

export const SERIES = [
  { key: "sold", label: "Vendido", color: "var(--color-bronze)" },
  { key: "received", label: "Recebido", color: "var(--color-success)" },
  { key: "due", label: "Vencido no mês", color: "var(--color-fg-subtle)" },
] as const;

function subscribeNarrow(cb: () => void) {
  const mq = window.matchMedia("(max-width: 639px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
const getNarrow = () => window.matchMedia("(max-width: 639px)").matches;

type TooltipEntry = { dataKey?: string | number; value?: number | string };

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: readonly TooltipEntry[]; label?: string | number }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-44 rounded-xl border border-line-strong bg-bg-elevated px-3 py-2.5 text-[12.5px] shadow-pop">
      <p className="mb-1.5 font-semibold capitalize text-fg">{typeof label === "string" ? formatMonthYear(label) : ""}</p>
      <ul className="space-y-1">
        {SERIES.map((s) => {
          const entry = payload.find((p) => p.dataKey === s.key);
          return (
            <li key={s.key} className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: s.color }} aria-hidden />
              <span className="flex-1 text-fg-muted">{s.label}</span>
              <span className="money font-medium text-fg">{formatBRL(entry?.value ?? 0)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Vendido x Recebido (barras) e Vencido (linha tracejada) por mês. Eixo único em R$. */
export default function MonthlyChartCanvas({ data }: { data: MonthPoint[] }) {
  const reduce = useReducedMotion();
  const narrow = useSyncExternalStore(subscribeNarrow, getNarrow, () => false);
  const animate = !reduce;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barGap={2} barCategoryGap={narrow ? "18%" : "24%"}>
        <CartesianGrid vertical={false} stroke="var(--color-line)" />
        <XAxis
          dataKey="month"
          tickFormatter={(v: string) => formatMonthYear(v)}
          interval={narrow ? 2 : 0}
          tickLine={false}
          axisLine={{ stroke: "var(--color-line-strong)" }}
          tick={{ fill: "var(--color-fg-muted)", fontSize: 11 }}
          tickMargin={8}
        />
        <YAxis
          tickFormatter={(v: number) => formatBRLCompact(v).replace("R$ ", "")}
          tickLine={false}
          axisLine={false}
          width={narrow ? 40 : 56}
          tickCount={narrow ? 4 : 5}
          tick={{ fill: "var(--color-fg-subtle)", fontSize: 11 }}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgb(255 255 255 / 0.04)" }} isAnimationActive={false} />
        <Bar dataKey="sold" name="Vendido" fill={SERIES[0].color} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={animate} animationDuration={500} />
        <Bar dataKey="received" name="Recebido" fill={SERIES[1].color} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={animate} animationDuration={500} />
        <Line
          dataKey="due"
          name="Vencido no mês"
          type="monotone"
          stroke={SERIES[2].color}
          strokeWidth={2}
          strokeDasharray="5 4"
          dot={{ r: 3, fill: "var(--color-card)", stroke: SERIES[2].color, strokeWidth: 2 }}
          activeDot={{ r: 5, fill: SERIES[2].color, stroke: "var(--color-card)", strokeWidth: 2 }}
          isAnimationActive={animate}
          animationDuration={600}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
