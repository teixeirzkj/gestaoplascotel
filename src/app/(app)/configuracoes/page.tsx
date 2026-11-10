import type { Metadata } from "next";
import { requireOwnerPage } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/states";
import { Tabs } from "@/components/ui/tabs";
import { FadeIn } from "@/components/ui/motion-list";
import { getEnvStatus, getSettings, getUsers } from "@/features/settings/queries";
import { BillingForm, CompanyForm, ProfileForm } from "@/features/settings/components/settings-forms";
import { UsersSection } from "@/features/settings/components/users-section";
import { BackupInfo, FutureIntegrations } from "@/features/settings/components/system-info";
import { getMessageSettings } from "@/features/messages/queries";
import { MessageSettingsForm } from "@/features/messages/components/settings-form";

export const metadata: Metadata = { title: "Configurações" };

const TABS = [
  { value: "geral", label: "Empresa e cobrança" },
  { value: "mensagens", label: "Mensagens" },
  { value: "usuarios", label: "Usuários" },
  { value: "perfil", label: "Meu perfil" },
  { value: "sistema", label: "Backup e integrações" },
] as const;
type TabKey = (typeof TABS)[number]["value"];

function LoadError({ what }: { what: string }) {
  return (
    <Card>
      <ErrorState title={`Não foi possível carregar ${what}`} description="Verifique sua conexão e recarregue a página." />
    </Card>
  );
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireOwnerPage();
  const sp = await searchParams;
  const raw = Array.isArray(sp.aba) ? sp.aba[0] : sp.aba;
  const tab: TabKey = TABS.some((t) => t.value === raw) ? (raw as TabKey) : "geral";

  let content: React.ReactNode;
  if (tab === "geral") {
    const settings = await getSettings().catch(() => null);
    content = settings ? (
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:items-start">
        <CompanyForm initial={settings.company} updatedAt={settings.updatedAt.company} />
        <BillingForm initial={settings.billing} updatedAt={settings.updatedAt.billing} />
      </div>
    ) : (
      <LoadError what="as configurações" />
    );
  } else if (tab === "mensagens") {
    const res = await getMessageSettings().catch(() => null);
    content = res ? <MessageSettingsForm initial={res.settings} company={res.company} /> : <LoadError what="as configurações de mensagens" />;
  } else if (tab === "usuarios") {
    const res = await getUsers().catch(() => null);
    content = res ? <UsersSection users={res.users} authAvailable={res.authAvailable} /> : <LoadError what="os usuários" />;
  } else if (tab === "perfil") {
    content = (
      <div className="max-w-2xl">
        <ProfileForm name={user.full_name} email={user.email} role={user.role} createdAt={user.created_at} />
      </div>
    );
  } else {
    content = (
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:items-start">
        <BackupInfo env={getEnvStatus()} />
        <FutureIntegrations />
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Configurações" description="Empresa, regras de cobrança, usuários e segurança." />
      <Tabs
        className="mb-5"
        value={tab}
        items={TABS.map((t) => ({ value: t.value, label: t.label, href: t.value === "geral" ? "/configuracoes" : `/configuracoes?aba=${t.value}` }))}
      />
      <FadeIn key={tab}>{content}</FadeIn>
    </>
  );
}
