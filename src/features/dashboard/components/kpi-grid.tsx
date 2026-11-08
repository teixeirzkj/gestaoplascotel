import { AlertTriangle, HandCoins, Users, Wallet } from "lucide-react";
import { MotionList } from "@/components/ui/motion-list";
import { StatCard } from "@/components/ui/stat-card";
import { formatBRL } from "@/lib/format";
import { getDashboardSummary } from "../queries";
import { safeLoad } from "./section";
import { SectionError } from "./section-error";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Os 4 indicadores principais (grade 2x2 no celular, 4 colunas no desktop). */
export async function KpiGrid() {
  const res = await safeLoad(getDashboardSummary);
  if (!res.ok) return <SectionError title="Indicadores indisponíveis" className="mb-4" />;
  const s = res.data;
  return (
    <MotionList className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        tone="paper"
        label="Total a receber"
        value={formatBRL(s.total_receivable)}
        hint={plural(s.customers_with_balance, "cliente com saldo", "clientes com saldo")}
        icon={<Wallet className="h-4 w-4" />}
        href="/cobrancas"
      />
      <StatCard
        tone={s.overdue_count > 0 ? "danger" : "default"}
        label="Cobranças atrasadas"
        value={formatBRL(s.overdue_amount)}
        hint={`${plural(s.overdue_count, "parcela", "parcelas")} · ${plural(s.overdue_customers, "cliente", "clientes")}`}
        icon={<AlertTriangle className="h-4 w-4" />}
        href="/cobrancas?aba=atrasadas"
      />
      <StatCard
        tone={s.received_today > 0 ? "success" : "default"}
        label="Recebido hoje"
        value={formatBRL(s.received_today)}
        hint={s.received_today_count ? plural(s.received_today_count, "pagamento confirmado", "pagamentos confirmados") : "Nenhum pagamento ainda"}
        icon={<HandCoins className="h-4 w-4" />}
        href="/cobrancas?aba=hoje"
      />
      <StatCard
        label="Clientes ativos"
        value={<span className="tabular">{s.active_customers}</span>}
        hint={`${s.customers_with_balance} com saldo em aberto`}
        icon={<Users className="h-4 w-4" />}
        href="/clientes"
      />
    </MotionList>
  );
}
