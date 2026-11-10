import type { Metadata } from "next";
import { AlertTriangle, QrCode } from "lucide-react";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/states";
import { ButtonLink } from "@/components/ui/button";
import { FadeIn } from "@/components/ui/motion-list";
import { formatDateLong } from "@/lib/format";
import { getMessageHistory, getMessageQueue } from "@/features/messages/queries";
import { QueueView } from "@/features/messages/components/queue-view";
import { HistoryView } from "@/features/messages/components/history-view";

export const metadata: Metadata = { title: "Mensagens" };

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  await requireUser();
  const user = await getCurrentUser();
  const { aba } = await searchParams;
  const tab = aba === "historico" ? "historico" : "fila";

  let content: React.ReactNode;
  let subtitle = "Lembretes e cobranças pelo WhatsApp, montados automaticamente todos os dias.";
  if (tab === "fila") {
    const res = await getMessageQueue().catch((e) => {
      console.error("[mensagens] fila", e);
      return null;
    });
    if (!res) {
      content = <Card><ErrorState title="Não foi possível montar a fila" description="Verifique sua conexão e recarregue a página." /></Card>;
    } else {
      subtitle = `${formatDateLong(res.today)} · ${res.items.length} mensagem(ns) para enviar`;
      content = (
        <div className="space-y-4">
          {!res.enabled && (
            <Notice icon={<AlertTriangle className="h-4 w-4" />} text="As mensagens de cobrança estão desativadas nas configurações." action={user?.isOwner ? { href: "/configuracoes?aba=mensagens", label: "Ativar" } : undefined} />
          )}
          {res.enabled && !res.pixConfigured && (
            <Notice
              icon={<QrCode className="h-4 w-4" />}
              text="Cadastre a chave Pix da empresa para incluir o Pix copia e cola com o valor exato em cada mensagem."
              action={user?.isOwner ? { href: "/configuracoes?aba=mensagens", label: "Cadastrar Pix" } : undefined}
            />
          )}
          <QueueView items={res.items} today={res.today} />
        </div>
      );
    }
  } else {
    const res = await getMessageHistory().catch((e) => {
      console.error("[mensagens] histórico", e);
      return null;
    });
    content = res ? <HistoryView rows={res.rows} stats={res.stats} /> : <Card><ErrorState title="Não foi possível carregar o histórico" /></Card>;
  }

  return (
    <>
      <PageHeader
        title="Mensagens"
        description={subtitle}
        actions={user?.isOwner ? <ButtonLink href="/configuracoes?aba=mensagens" variant="secondary" size="sm">Textos e calendário</ButtonLink> : undefined}
      />
      <Tabs
        className="mb-5"
        value={tab}
        items={[
          { value: "fila", label: "Fila de hoje", href: "/mensagens" },
          { value: "historico", label: "Histórico", href: "/mensagens?aba=historico" },
        ]}
      />
      <FadeIn key={tab}>{content}</FadeIn>
    </>
  );
}

function Notice({ icon, text, action }: { icon: React.ReactNode; text: string; action?: { href: string; label: string } }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-warning/30 bg-warning-soft px-4 py-3 sm:flex-row sm:items-center">
      <span className="flex items-start gap-2.5 text-[13px] text-fg">
        <span className="mt-0.5 text-warning">{icon}</span>
        {text}
      </span>
      {action && <ButtonLink href={action.href} variant="secondary" size="sm" className="sm:ml-auto">{action.label}</ButtonLink>}
    </div>
  );
}
