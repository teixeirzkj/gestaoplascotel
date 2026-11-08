import { Card, CardBody } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/states";
import type { ActivityView, CustomerView, InstallmentView, PaymentView, PromiseView, SaleView } from "@/types/database";
import {
  getAllInstallments,
  getCustomerActivity,
  getCustomerNotes,
  getCustomerPayments,
  getCustomerPostponements,
  getCustomerPromises,
  getCustomerSales,
} from "../queries";
import type { CustomerTab } from "../schemas";
import type { CustomerNoteItem, PostponementItem } from "../types";
import { ActivityTimeline } from "./activity-timeline";
import { FinancialTab } from "./financial-tab";
import { NotesTab } from "./notes-tab";
import { OverviewTab } from "./overview-tab";
import { PurchasesTab } from "./purchases-tab";

export type CustomerTabData =
  | { tab: "compras"; sales: SaleView[] }
  | {
      tab: "financeiro";
      installments: InstallmentView[];
      sales: SaleView[];
      payments: PaymentView[];
      postponements: PostponementItem[];
      promises: PromiseView[];
    }
  | { tab: "historico"; activity: ActivityView[] }
  | { tab: "observacoes"; notes: CustomerNoteItem[] }
  | { tab: "visao"; promises: PromiseView[]; activity: ActivityView[] };

/**
 * Dispara as consultas da aba sem depender do cliente já carregado (só do `id`).
 * A página chama isto antes de buscar o cliente, para que tudo saia em uma única ida ao banco.
 */
export async function loadTabData(tab: CustomerTab, id: string): Promise<CustomerTabData> {
  switch (tab) {
    case "compras":
      return { tab, sales: await getCustomerSales(id) };
    case "financeiro": {
      const [installments, sales, payments, postponements, promises] = await Promise.all([
        getAllInstallments(id),
        getCustomerSales(id),
        getCustomerPayments(id),
        getCustomerPostponements(id),
        getCustomerPromises(id),
      ]);
      return { tab, installments, sales, payments, postponements, promises };
    }
    case "historico":
      return { tab, activity: await getCustomerActivity(id) };
    case "observacoes":
      return { tab, notes: await getCustomerNotes(id) };
    default: {
      const [promises, activity] = await Promise.all([getCustomerPromises(id, true), getCustomerActivity(id, 0, 5)]);
      return { tab: "visao", promises, activity };
    }
  }
}

/** Conteúdo da aba ativa (Server Component assíncrono, transmitido em <Suspense key={tab}>). */
export async function CustomerTabContent({
  data,
  customer,
  canSell,
  openInstallments,
}: {
  data: Promise<CustomerTabData>;
  customer: CustomerView;
  canSell: boolean;
  openInstallments: InstallmentView[];
}) {
  const id = customer.id;
  const d = await data;
  switch (d.tab) {
    case "compras":
      return <PurchasesTab sales={d.sales} customerId={id} canSell={canSell} />;
    case "financeiro":
      return <FinancialTab installments={d.installments} sales={d.sales} payments={d.payments} postponements={d.postponements} promises={d.promises} />;
    case "historico":
      return (
        <Card>
          <CardBody>
            <ActivityTimeline key={`${d.activity[0]?.id ?? 0}-${d.activity.length}`} customerId={id} initial={d.activity} />
          </CardBody>
        </Card>
      );
    case "observacoes":
      return <NotesTab customerId={id} registrationNotes={customer.notes} notes={d.notes} />;
    case "visao":
      return <OverviewTab customerId={id} openInstallments={openInstallments} promises={d.promises} activity={d.activity} />;
  }
}

export function TabSkeleton({ tab }: { tab: CustomerTab }) {
  if (tab === "historico") {
    return (
      <div className="space-y-4 rounded-2xl border border-line bg-card p-4 sm:p-5" role="status" aria-label="Carregando histórico">
        <Skeleton className="h-4 w-24" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-full max-w-md" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-3" role="status" aria-label="Carregando">
      {Array.from({ length: tab === "visao" ? 2 : 3 }).map((_, i) => (
        <div key={i} className="space-y-2 rounded-2xl border border-line bg-card p-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-[104px] rounded-xl" />
          <Skeleton className="h-[104px] rounded-xl" />
        </div>
      ))}
    </div>
  );
}
