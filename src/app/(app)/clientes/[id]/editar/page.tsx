import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requireOwnerPage } from "@/lib/auth";
import { formatDateTime, maskPhone } from "@/lib/format";
import { CustomerForm } from "@/features/customers/components/customer-form";
import { getCity, getCustomer, listActiveCities } from "@/features/customers/queries";

export const metadata: Metadata = { title: "Editar cliente" };

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOwnerPage();
  const { id } = await params;
  const [customer, cities] = await Promise.all([getCustomer(id), listActiveCities()]);
  if (!customer) notFound();

  // Mantém a cidade atual no select mesmo se ela tiver sido arquivada
  let options = cities;
  if (customer.city_id && !cities.some((c) => c.id === customer.city_id)) {
    const current = await getCity(customer.city_id);
    if (current) options = [...cities, current].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Editar cliente"
        description={`${customer.full_name} · cadastrado em ${formatDateTime(customer.created_at)}`}
        back={{ href: `/clientes/${customer.id}`, label: "Ficha do cliente" }}
      />
      <CustomerForm
        mode="edit"
        customerId={customer.id}
        cities={options}
        defaultValues={{
          full_name: customer.full_name,
          phone: maskPhone(customer.phone ?? ""),
          whatsapp: maskPhone(customer.whatsapp ?? ""),
          city_id: customer.city_id ?? "",
          neighborhood: customer.neighborhood ?? "",
          address: customer.address ?? "",
          reference: customer.reference ?? "",
          notes: customer.notes ?? "",
        }}
      />
    </div>
  );
}
