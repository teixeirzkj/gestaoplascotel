"use client";

import { useState } from "react";
import { Building2, Download, FileSpreadsheet, Loader2, ReceiptText, ShoppingBag, TriangleAlert, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ExportKind = "resumo" | "cidades" | "inadimplencia" | "caixa" | "vendas";

/** Baixa o CSV do route handler; erros do servidor viram toast com a mensagem. */
async function downloadCsv(kind: ExportKind, from: string, to: string) {
  const qs = new URLSearchParams({ periodo: "custom", de: from, ate: to });
  const res = await fetch(`/api/export/${kind}?${qs.toString()}`, { cache: "no-store" });
  if (!res.ok) {
    const msg = (await res.text().catch(() => "")) || "Não foi possível gerar o arquivo.";
    throw new Error(msg.length > 200 ? "Não foi possível gerar o arquivo." : msg);
  }
  // Sessão expirada: o proxy redireciona para /login (HTML) em vez de responder o CSV.
  if (res.redirected || !(res.headers.get("Content-Type") ?? "").includes("text/csv")) {
    throw new Error("Sessão expirada. Entre novamente para exportar.");
  }
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `plascotel-${kind}.csv`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return name;
}

function useCsvDownload() {
  const [busy, setBusy] = useState<ExportKind | null>(null);
  async function run(kind: ExportKind, from: string, to: string) {
    if (busy) return;
    setBusy(kind);
    try {
      const name = await downloadCsv(kind, from, to);
      toast.success("Arquivo gerado", { description: name });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar o arquivo.");
    } finally {
      setBusy(null);
    }
  }
  return { busy, run };
}

/** Botão único de exportação (ex.: movimentações do caixa de um dia). */
export function CsvButton({
  kind,
  from,
  to,
  label = "Exportar CSV",
  variant = "ghost",
  size = "sm",
  className,
}: {
  kind: ExportKind;
  from: string;
  to: string;
  label?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  const { busy, run } = useCsvDownload();
  return (
    <Button variant={variant} size={size} loading={busy === kind} onClick={() => run(kind, from, to)} className={className}>
      {busy !== kind && <Download className="h-4 w-4" />}
      {label}
    </Button>
  );
}

const OPTIONS: { kind: ExportKind; title: string; description: string; icon: React.ReactNode; periodBased: boolean }[] = [
  { kind: "resumo", title: "Resumo do período", description: "Vendido, recebido por forma, saldo e atraso.", icon: <FileSpreadsheet className="h-4 w-4" />, periodBased: true },
  { kind: "cidades", title: "Por cidade", description: "Vendido, recebido, pendente e atraso por cidade.", icon: <Building2 className="h-4 w-4" />, periodBased: true },
  { kind: "inadimplencia", title: "Inadimplência detalhada", description: "Todas as parcelas em atraso hoje, com faixa e telefone.", icon: <TriangleAlert className="h-4 w-4" />, periodBased: false },
  { kind: "caixa", title: "Movimentações do caixa", description: "Recebimentos, estornos e ajustes do período.", icon: <Wallet className="h-4 w-4" />, periodBased: true },
  { kind: "vendas", title: "Vendas do período", description: "Cada venda com total, pago, saldo e situação.", icon: <ShoppingBag className="h-4 w-4" />, periodBased: true },
];

/** Botão "Exportar" que abre a lista de relatórios CSV do período. */
export function ExportMenu({ from, to }: { from: string; to: string }) {
  const [open, setOpen] = useState(false);
  const { busy, run } = useCsvDownload();

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Download className="h-4 w-4" /> Exportar
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Exportar planilhas"
        description={
          <>
            Período: <span className="font-medium text-fg">{formatDate(from)}</span> a <span className="font-medium text-fg">{formatDate(to)}</span>. Arquivos
            CSV prontos para o Excel.
          </>
        }
      >
        <ul className="-mx-1 space-y-1.5">
          {OPTIONS.map((o) => {
            const loading = busy === o.kind;
            return (
              <li key={o.kind}>
                <button
                  type="button"
                  onClick={() => run(o.kind, from, to)}
                  disabled={Boolean(busy)}
                  className={cn(
                    "flex min-h-16 w-full cursor-pointer items-center gap-3 rounded-xl border border-line bg-card px-3.5 py-3 text-left transition-[background-color,transform] duration-150",
                    "hover:bg-card-hover active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60",
                  )}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bronze-soft text-bronze">{o.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-fg">{o.title}</span>
                    <span className="mt-0.5 block text-[12.5px] leading-snug text-fg-muted">
                      {o.description}
                      {!o.periodBased && " Não depende do período."}
                    </span>
                  </span>
                  {loading ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-bronze" aria-label="Gerando" />
                  ) : (
                    <Download className="h-4 w-4 shrink-0 text-fg-subtle" aria-hidden />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 flex items-start gap-2 text-[12px] leading-relaxed text-fg-subtle">
          <ReceiptText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Separador “;”, valores com vírgula e datas DD/MM/AAAA. Saldo a receber e atraso refletem a posição de hoje.
        </p>
      </Modal>
    </>
  );
}
