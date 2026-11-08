import { CheckCircle2, CircleSlash, DatabaseBackup, Lock, MapPinned, MessageCircle, Plug, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { EnvStatus } from "../queries";

export function BackupInfo({ env }: { env: EnvStatus }) {
  const allOk = env.every((e) => e.present);
  return (
    <Card>
      <CardHeader
        title="Backup e segurança"
        description="Como os dados estão protegidos e como gerar cópias."
        icon={<DatabaseBackup className="h-4 w-4" />}
        action={<Badge tone={allOk ? "success" : "warning"}>{allOk ? "Configuração completa" : "Configuração incompleta"}</Badge>}
      />
      <CardBody className="space-y-5">
        <ul className="space-y-3 text-[13.5px] leading-relaxed text-fg-muted">
          <li className="flex gap-3">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-bronze" aria-hidden />
            <span>
              <strong className="font-medium text-fg">Backups automáticos:</strong> o Supabase faz cópias diárias do banco. Confira a retenção e
              restaure pelo painel do projeto em <em>Database → Backups</em>.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-bronze" aria-hidden />
            <span>
              <strong className="font-medium text-fg">Cópia manual:</strong> gere um arquivo com{" "}
              <code className="rounded-md bg-bg-elevated px-1.5 py-0.5 text-[12.5px] text-fg">pg_dump</code> usando a string de conexão do
              projeto e guarde fora do computador de trabalho. O passo a passo fica em{" "}
              <code className="rounded-md bg-bg-elevated px-1.5 py-0.5 text-[12.5px] text-fg">docs/BACKUP.md</code>.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-bronze" aria-hidden />
            <span>
              <strong className="font-medium text-fg">Proteção dos dados:</strong> regras de acesso no banco (RLS), operações financeiras somente
              por funções auditadas, comprovantes em armazenamento privado e histórico que não pode ser apagado.
            </span>
          </li>
        </ul>

        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">
            <Lock className="h-3.5 w-3.5" aria-hidden /> Variáveis do servidor
          </p>
          <ul className="divide-y divide-line rounded-xl border border-line bg-bg-elevated">
            {env.map((e) => (
              <li key={e.name} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-medium text-fg">{e.label}</p>
                  <p className="truncate font-mono text-[11.5px] text-fg-subtle">
                    {e.name}
                    {e.serverOnly ? " · somente servidor" : ""}
                  </p>
                </div>
                {e.present ? (
                  <span className="flex shrink-0 items-center gap-1 text-[12.5px] font-medium text-success">
                    <CheckCircle2 className="h-4 w-4" aria-hidden /> Configurada
                  </span>
                ) : (
                  <span className="flex shrink-0 items-center gap-1 text-[12.5px] font-medium text-danger-fg">
                    <XCircle className="h-4 w-4" aria-hidden /> Ausente
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[12px] text-fg-subtle">Os valores nunca são exibidos. A chave secreta não é enviada ao navegador.</p>
        </div>
      </CardBody>
    </Card>
  );
}

export function FutureIntegrations() {
  const items = [
    {
      icon: MessageCircle,
      title: "WhatsApp",
      text: "Hoje os botões apenas abrem a conversa no seu WhatsApp. A estrutura está pronta para integração oficial, sem disparos automáticos.",
    },
    {
      icon: MapPinned,
      title: "Mapas e rotas",
      text: "Clientes, cidades e visitas já guardam coordenadas e ordem de parada para roteirização futura.",
    },
  ];
  return (
    <Card>
      <CardHeader title="Integrações futuras" description="Recursos preparados, ainda desativados." icon={<Plug className="h-4 w-4" />} />
      <CardBody className="grid gap-3 sm:grid-cols-2">
        {items.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-xl border border-line bg-bg-elevated p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-semibold text-fg">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-bronze-soft text-bronze">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                {title}
              </span>
              <Badge tone="muted" dot={false}>
                <CircleSlash className="h-3 w-3" aria-hidden /> Desativado
              </Badge>
            </div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-fg-muted">{text}</p>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
