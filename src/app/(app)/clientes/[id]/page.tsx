import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, ChevronLeft, MapPin, Receipt, ShoppingBag, Wallet, ListChecks } from "lucide-react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ContactButtons, Avatar } from "@/components/ui/misc";
import { MotionList, SwapContent } from "@/components/ui/motion-list";
import { StatCard } from "@/components/ui/stat-card";
import { Tabs } from "@/components/ui/tabs";
import { requireUser } from "@/lib/auth";
import { CUSTOMER_STATUS } from "@/lib/labels";
import { formatBRL, formatDate, formatRelativeDays, tsToBahiaDate } from "@/lib/format";
import { diffDays, todayISO } from "@/lib/dates";
import { num } from "@/lib/money";
import { cn } from "@/lib/utils";
import { ArchiveCustomerButton, CustomerQuickActions } from "@/features/customers/components/customer-actions";
import { CustomerDetailsCard } from "@/features/customers/components/customer-details-card";
import { CustomerTabContent, TabSkeleton, loadTabData } from "@/features/customers/components/customer-tab-content";
import { countCustomerNotes, getCustomer, getOpenInstallments } from "@/features/customers/queries";
import { isUuid, parseTab, type CustomerTab } from "@/features/customers/schemas";
import { MessagesOptOutCard } from "@/features/messages/components/opt-out-card";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const customer = await getCustomer(id).catch(() => null);
  return { title: customer?.full_name ?? "Cliente" };
}

function MiniDate({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "danger" | "warning" }) {
  return (
    <div className="min-w-0 px-2.5 py-3 sm:px-5">
      <p className="text-[11px] font-medium leading-tight text-fg-muted sm:text-[12px]">{label}</p>
      <p className={cn("tabular mt-1 whitespace-nowrap text-[13px] font-semibold sm:text-[15px]", tone === "danger" ? "text-danger-fg" : tone === "warning" ? "text-warning" : "text-fg")}>
        {value}
      </p>
      {hint && <p className="mt-0.5 truncate text-[11px] text-fg-subtle">{hint}</p>}
    </div>
  );
}

function relative(iso: string | null) {
  if (!iso) return undefined;
  return formatRelativeDays(diffDays(todayISO(), iso));
}

export default async function CustomerPage({ params, searchParams }: Props) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!isUuid(id)) notFound();
  const tab: CustomerTab = parseTab(sp.aba);

  // Tudo depende só do `id`: dados da aba e da ficha saem juntos, em uma única ida ao banco.
  // A promessa da aba é consumida dentro do <Suspense>; o catch evita rejeição não tratada se der notFound().
  const tabData = loadTabData(tab, id);
  tabData.catch(() => {});

  const [user, customer, openInstallments, notesCount] = await Promise.all([
    requireUser(),
    getCustomer(id),
    getOpenInstallments(id),
    countCustomerNotes(id),
  ]);
  if (!customer) notFound();
  const archived = Boolean(customer.archived_at);
  const today = todayISO();

  const base = `/clientes/${id}`;
  const tabs = [
    { value: "visao", label: "Visão geral", href: base },
    { value: "compras", label: "Compras", count: customer.sales_count, href: `${base}?aba=compras` },
    { value: "financeiro", label: "Financeiro", count: customer.open_installments, href: `${base}?aba=financeiro` },
    { value: "historico", label: "Histórico", href: `${base}?aba=historico` },
    { value: "observacoes", label: "Observações", count: notesCount, href: `${base}?aba=observacoes` },
  ];

  const overdue = num(customer.overdue_amount);
  const balance = num(customer.balance);
  const nextDate = customer.next_collection_date;
  const lastContactDay = customer.last_contact_at ? tsToBahiaDate(customer.last_contact_at) : null;
  const place = [customer.city_name ? `${customer.city_name}/${customer.city_state ?? ""}`.replace(/\/$/, "") : null, customer.neighborhood]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-4 sm:space-y-5">
      <Link
        href="/clientes"
        className="-ml-1 inline-flex h-8 items-center gap-1 rounded-lg pr-2 text-[13px] font-medium text-fg-muted transition-colors hover:text-fg"
      >
        <ChevronLeft className="h-4 w-4" /> Clientes
      </Link>

      {archived && (
        <div className="flex flex-col gap-2 rounded-2xl border border-warning/25 bg-warning-soft px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-[13px] text-fg">
            <Archive className="h-4 w-4 shrink-0 text-warning" aria-hidden />
            Cliente arquivado em {formatDate(tsToBahiaDate(customer.archived_at as string))}. Histórico e saldos continuam disponíveis.
          </p>
          <ArchiveCustomerButton customerId={id} customerName={customer.full_name} archived />
        </div>
      )}

      <section className="rounded-2xl border border-line bg-card p-4 shadow-card sm:p-5">
        <div className="flex items-start gap-3.5">
          <Avatar name={customer.full_name} className="h-14 w-14 rounded-2xl text-[17px]" />
          <div className="min-w-0 flex-1">
            <h1 className="break-words text-[21px] font-semibold leading-tight tracking-tight text-fg sm:text-[26px]">{customer.full_name}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-[13px] text-fg-muted">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">{place || "Cidade não informada"}</span>
            </p>
          </div>
          <ContactButtons phone={customer.phone} whatsapp={customer.whatsapp} size="icon" className="hidden sm:flex" />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={customer.financial_status} map={CUSTOMER_STATUS} />
            {archived && <Badge tone="muted">Arquivado</Badge>}
          </div>
          <ContactButtons phone={customer.phone} whatsapp={customer.whatsapp} size="icon" className="sm:hidden" />
        </div>
        <div className="mt-4 border-t border-line pt-4">
          <CustomerQuickActions customerId={id} customerName={customer.full_name} archived={archived} openInstallments={openInstallments} />
        </div>
      </section>

      <MotionList className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Total comprado"
          value={formatBRL(customer.total_purchased)}
          hint={customer.sales_count === 1 ? "1 compra" : `${customer.sales_count} compras`}
          icon={<ShoppingBag className="h-4 w-4" />}
        />
        <StatCard label="Total pago" value={formatBRL(customer.total_paid)} icon={<Wallet className="h-4 w-4" />} tone={num(customer.total_paid) > 0 ? "success" : "default"} />
        <StatCard
          label="Saldo devedor"
          value={formatBRL(balance)}
          hint={overdue > 0 ? `${formatBRL(overdue)} em atraso` : balance > 0 ? "nenhum valor em atraso" : "nada em aberto"}
          tone="paper"
        />
        <StatCard
          label="Parcelas pendentes"
          value={<span className="tabular">{customer.open_installments}</span>}
          hint={overdue > 0 ? "há parcelas atrasadas" : customer.open_installments > 0 ? "todas em dia" : "nenhuma em aberto"}
          icon={overdue > 0 ? <Receipt className="h-4 w-4" /> : <ListChecks className="h-4 w-4" />}
          tone={overdue > 0 ? "danger" : "default"}
        />
      </MotionList>

      <div className="grid grid-cols-3 divide-x divide-line rounded-2xl border border-line bg-card shadow-card">
        <MiniDate
          label="Próxima cobrança"
          value={nextDate ? (nextDate === today ? "Hoje" : formatDate(nextDate)) : "—"}
          hint={nextDate && nextDate !== today ? relative(nextDate) : undefined}
          tone={nextDate && nextDate < today ? "danger" : nextDate === today ? "warning" : undefined}
        />
        <MiniDate label="Último pagamento" value={formatDate(customer.last_payment_date)} hint={relative(customer.last_payment_date)} />
        <MiniDate label="Último contato" value={formatDate(lastContactDay)} hint={relative(lastContactDay)} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          <Tabs items={tabs} value={tab} />
          <SwapContent id={tab}>
            <Suspense key={tab} fallback={<TabSkeleton tab={tab} />}>
              <CustomerTabContent data={tabData} customer={customer} canSell={user.isOwner && !archived} openInstallments={openInstallments} />
            </Suspense>
          </SwapContent>
        </div>
        <aside className="space-y-3 lg:sticky lg:top-20">
          <CustomerDetailsCard customer={customer} />
          <Suspense fallback={null}>
            <MessagesOptOutCard customerId={id} />
          </Suspense>
          {!archived && (
            <div className="flex justify-center lg:justify-start">
              <ArchiveCustomerButton customerId={id} customerName={customer.full_name} archived={false} balance={balance} />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
