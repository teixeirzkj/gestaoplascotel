import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import { requireOwnerPage } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { PageHeader } from "@/components/ui/page-header";
import { listActiveProducts } from "@/features/products/queries";
import { getSettings } from "@/features/settings/queries";
import { intervalFromDays } from "@/features/sales/calc";
import { getCustomerOption, hasActiveCustomers, listCities } from "@/features/sales/queries";
import { NewSaleForm } from "@/features/sales/components/new-sale/new-sale-form";

export const metadata: Metadata = { title: "Nova venda" };

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function NewSalePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireOwnerPage();
  const sp = await searchParams;
  const initialCustomerId = one(sp.cliente);
  const [initialCustomer, hasCustomers, products, cities, settings] = await Promise.all([
    initialCustomerId ? getCustomerOption(initialCustomerId) : Promise.resolve(null),
    hasActiveCustomers(),
    listActiveProducts(),
    listCities(),
    getSettings(),
  ]);

  return (
    <>
      <PageHeader title="Nova venda" description="Registre a venda e gere as parcelas automaticamente." back={{ href: "/vendas", label: "Vendas" }} />
      <NewSaleForm
        initialCustomer={initialCustomer}
        hasCustomers={hasCustomers}
        products={products}
        cities={cities}
        today={todayISO()}
        idempotencyKey={randomUUID()}
        defaultInterval={intervalFromDays(settings.billing.default_interval_days)}
      />
    </>
  );
}
