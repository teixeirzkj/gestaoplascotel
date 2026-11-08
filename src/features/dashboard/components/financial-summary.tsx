import Link from "next/link";
import { ChevronRight, PieChart } from "lucide-react";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getDashboardSummary } from "../queries";
import { DashSection, safeLoad } from "./section";
import { SectionError } from "./section-error";

type Row = { label: string; value: string; href?: string; tone?: "danger" | "warning" | "success" | "default"; strong?: boolean };

/** Resumo financeiro do mês e pendências operacionais (dashboard_summary). */
export async function FinancialSummary() {
  const res = await safeLoad(getDashboardSummary);
  if (!res.ok) return <SectionError title="Resumo financeiro indisponível" />;
  const s = res.data;

  const rows: Row[] = [
    { label: "Vendido no mês", value: formatBRL(s.sold_month), href: "/vendas" },
    { label: "Recebido no mês", value: formatBRL(s.received_month), tone: s.received_month > 0 ? "success" : "default", href: "/cobrancas" },
    { label: "A receber", value: formatBRL(s.total_receivable), strong: true, href: "/cobrancas" },
    { label: "Atrasado", value: formatBRL(s.overdue_amount), tone: s.overdue_amount > 0 ? "danger" : "default", href: "/cobrancas?aba=atrasadas" },
    {
      label: "Pagamentos a confirmar",
      value: String(s.pending_confirmations),
      tone: s.pending_confirmations > 0 ? "warning" : "default",
      href: "/cobrancas?aba=confirmar",
    },
    {
      label: "Promessas não cumpridas",
      value: String(s.broken_promises),
      tone: s.broken_promises > 0 ? "danger" : "default",
      href: "/cobrancas",
    },
  ];

  return (
    <DashSection title="Resumo financeiro" icon={<PieChart className="h-4 w-4" />}>
      <ul className="-mx-2 divide-y divide-line">
        {rows.map((r) => (
          <li key={r.label}>
            <SummaryRow row={r} />
          </li>
        ))}
      </ul>
    </DashSection>
  );
}

function SummaryRow({ row }: { row: Row }) {
  const toneCls = {
    danger: "text-danger-fg",
    warning: "text-warning",
    success: "text-success",
    default: "text-fg",
  }[row.tone ?? "default"];
  const inner = (
    <>
      <span className="text-[13.5px] text-fg-muted">{row.label}</span>
      <span className="flex items-center gap-1">
        <span className={cn("money text-[14px] font-semibold", toneCls, row.strong && "text-[15px]")}>{row.value}</span>
        {row.href && <ChevronRight className="h-4 w-4 text-fg-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />}
      </span>
    </>
  );
  const cls = "group flex min-h-11 items-center justify-between gap-3 rounded-lg px-2";
  return row.href ? (
    <Link href={row.href} className={cn(cls, "transition-colors hover:bg-white/[0.03]")}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}
