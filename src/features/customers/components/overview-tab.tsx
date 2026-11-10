import Link from "next/link";
import { ArrowRight, CalendarCheck, Handshake, History } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import type { ActivityView, InstallmentView, PromiseView } from "@/types/database";
import { ActivityMiniList } from "./activity-timeline";
import { InstallmentCardList, installmentLabel } from "./installment-items";
import { PromiseList } from "./promise-items";

const MAX_OPEN = 6;

function SeeAll({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      scroll={false}
      className="-my-2 inline-flex h-9 items-center gap-1 rounded-lg px-2 text-[13px] font-medium text-bronze transition-colors hover:bg-bronze-soft"
    >
      {label} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
    </Link>
  );
}

export function OverviewTab({
  customerId,
  openInstallments,
  promises,
  activity,
}: {
  customerId: string;
  openInstallments: InstallmentView[];
  promises: PromiseView[];
  activity: ActivityView[];
}) {
  const base = `/clientes/${customerId}`;
  const labels = new Map(openInstallments.map((i) => [i.id, `${installmentLabel(i.number)} · venda #${i.sale_code}`]));
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card className="xl:col-span-2">
        <CardHeader
          title="Próximas parcelas"
          description={openInstallments.length ? `${openInstallments.length} em aberto, por data de cobrança` : undefined}
          icon={<CalendarCheck className="h-4 w-4" />}
          action={openInstallments.length > MAX_OPEN && <SeeAll href={`${base}?aba=financeiro`} label="Ver todas" />}
        />
        <CardBody>
          {openInstallments.length === 0 ? (
            <EmptyState compact title="Nenhuma parcela em aberto" description="Quando houver vendas parceladas, as próximas cobranças aparecem aqui." />
          ) : (
            <InstallmentCardList items={openInstallments.slice(0, MAX_OPEN)} />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Promessas pendentes" icon={<Handshake className="h-4 w-4" />} />
        <CardBody>
          {promises.length === 0 ? (
            <EmptyState compact title="Nenhuma promessa pendente" description="Use o botão “Promessa” para registrar um compromisso de pagamento." />
          ) : (
            <PromiseList items={promises} labels={labels} />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Últimas atividades"
          icon={<History className="h-4 w-4" />}
          action={activity.length > 0 && <SeeAll href={`${base}?aba=historico`} label="Histórico" />}
        />
        <CardBody>
          {activity.length === 0 ? <EmptyState compact title="Nenhuma atividade ainda" /> : <ActivityMiniList items={activity} />}
        </CardBody>
      </Card>
    </div>
  );
}
