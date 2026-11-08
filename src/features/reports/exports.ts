import "server-only";
import { CASH_KIND, methodLabel, SALE_STATUS } from "@/lib/labels";
import { formatDate, formatPhone, formatTime } from "@/lib/format";
import { toCsv } from "./csv";
import {
  getCashMovementsInRange,
  getDelinquencyAging,
  getOverdueInstallments,
  getReportByCity,
  getReportSummary,
  getSalesInRange,
} from "./queries";

export const EXPORT_TYPES = ["resumo", "cidades", "inadimplencia", "caixa", "vendas"] as const;
export type ExportType = (typeof EXPORT_TYPES)[number];

export function isExportType(v: string): v is ExportType {
  return (EXPORT_TYPES as readonly string[]).includes(v);
}

const FILE_LABEL: Record<ExportType, string> = {
  resumo: "resumo",
  cidades: "por-cidade",
  inadimplencia: "inadimplencia",
  caixa: "caixa",
  vendas: "vendas",
};

export function exportFileName(type: ExportType, from: string, to: string, today: string): string {
  if (type === "inadimplencia") return `plascotel-inadimplencia-${today}.csv`;
  return from === to ? `plascotel-${FILE_LABEL[type]}-${from}.csv` : `plascotel-${FILE_LABEL[type]}-${from}_a_${to}.csv`;
}

const AGING_LABEL = (days: number) => {
  const d = Math.max(days, 1);
  if (d <= 7) return "Até 7 dias";
  if (d <= 15) return "8 a 15 dias";
  if (d <= 30) return "16 a 30 dias";
  return "Acima de 30 dias";
};

export async function buildExport(type: ExportType, from: string, to: string, today: string): Promise<string> {
  switch (type) {
    case "resumo": {
      const [s, aging] = await Promise.all([getReportSummary(from, to), getDelinquencyAging()]);
      return toCsv(
        ["Indicador", "Valor", "Observação"],
        [
          ["Período", `${formatDate(from)} a ${formatDate(to)}`, ""],
          ["Total vendido (faturamento)", { money: s.total_sold }, "Vendas não canceladas no período"],
          ["Quantidade de vendas", s.sales_count, ""],
          ["Vendas quitadas", s.paid_sales_count, "Vendas do período já quitadas"],
          ["Total recebido", { money: s.total_received }, "Pagamentos confirmados no período"],
          ["Recebido via Pix", { money: s.received_by_method.pix }, ""],
          ["Recebido em dinheiro", { money: s.received_by_method.cash }, ""],
          ["Recebido via transferência", { money: s.received_by_method.transfer }, ""],
          ["Recebido por outras formas", { money: s.received_by_method.other }, ""],
          ["Saldo a receber", { money: s.total_pending }, `Posição em ${formatDate(today)} (todas as parcelas em aberto)`],
          ["Total em atraso", { money: s.total_overdue }, `Posição em ${formatDate(today)}`],
          ["Clientes inadimplentes", s.delinquent_customers, `Posição em ${formatDate(today)}`],
          ...aging.map((a) => [
            `Atraso ${a.bucket.toLowerCase()}`,
            { money: a.amount },
            `${a.installments_count} parcela(s) · ${a.customers_count} cliente(s)`,
          ]),
        ],
      );
    }
    case "cidades": {
      const rows = await getReportByCity(from, to);
      return toCsv(
        ["Cidade", "UF", "Vendido no período", "Recebido no período", "Saldo a receber (atual)", "Em atraso (atual)", "Clientes", "Clientes em atraso"],
        rows.map((r) => [
          r.city_name,
          r.state ?? "",
          { money: r.total_sold },
          { money: r.total_received },
          { money: r.total_pending },
          { money: r.total_overdue },
          r.customers_count,
          r.overdue_customers,
        ]),
      );
    }
    case "inadimplencia": {
      const rows = await getOverdueInstallments(50_000, { strict: true });
      return toCsv(
        ["Cliente", "Telefone", "Cidade", "Venda", "Parcela", "Vencimento original", "Data de cobrança", "Dias em atraso", "Faixa", "Valor em aberto"],
        rows.map((r) => [
          r.customer_name,
          r.customer_whatsapp || r.customer_phone ? formatPhone(r.customer_whatsapp || r.customer_phone) : "",
          r.city_name ?? "",
          `#${r.sale_code}`,
          r.number,
          { date: r.original_due_date },
          { date: r.collection_date },
          Math.max(r.days_overdue, 1),
          AGING_LABEL(r.days_overdue),
          { money: r.remaining },
        ]),
      );
    }
    case "caixa": {
      const rows = await getCashMovementsInRange(from, to);
      return toCsv(
        ["Data", "Hora do lançamento", "Tipo", "Forma", "Valor", "Cliente", "Descrição", "Usuário"],
        rows.map((m) => [
          { date: m.occurred_on },
          formatTime(m.created_at),
          CASH_KIND[m.kind]?.label ?? m.kind,
          methodLabel(m.method),
          { money: m.amount },
          m.customer_name ?? "",
          m.description,
          m.created_by_name ?? "Sistema",
        ]),
      );
    }
    case "vendas": {
      const rows = await getSalesInRange(from, to);
      return toCsv(
        ["Venda", "Data", "Cliente", "Cidade", "Situação", "Total", "Pago", "Saldo", "Parcelas"],
        rows.map((r) => [
          `#${r.code}`,
          { date: r.sale_date },
          r.customer_name,
          r.city_name ?? "",
          SALE_STATUS[r.status]?.label ?? r.status,
          { money: r.total },
          { money: r.paid_total },
          { money: r.balance },
          r.installments_count,
        ]),
      );
    }
  }
}
