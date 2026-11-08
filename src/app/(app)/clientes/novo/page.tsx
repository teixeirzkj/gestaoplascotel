import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { requireOwnerPage } from "@/lib/auth";
import { CustomerForm } from "@/features/customers/components/customer-form";
import { listActiveCities } from "@/features/customers/queries";

export const metadata: Metadata = { title: "Novo cliente" };

export default async function NewCustomerPage() {
  await requireOwnerPage();
  const cities = await listActiveCities();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Novo cliente"
        description="Somente o nome é obrigatório. A data de cadastro é registrada automaticamente."
        back={{ href: "/clientes", label: "Clientes" }}
      />
      <CustomerForm mode="create" cities={cities} />
    </div>
  );
}
