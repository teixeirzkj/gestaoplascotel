"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Check, ChevronDown, Copy, MessageCircle, MoreHorizontal, PartyPopper, Pencil, SkipForward, BellOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Field, Textarea } from "@/components/ui/field";
import { Avatar } from "@/components/ui/misc";
import { EmptyState } from "@/components/ui/states";
import { cn } from "@/lib/utils";
import { formatBRL, formatDate, formatPhone, whatsappLink } from "@/lib/format";
import { listItem } from "@/lib/motion";
import { useEnterInitial } from "@/lib/use-hydrated";
import { KIND_META, type MessageKind } from "../config";
import type { RenderedQueueItem } from "../queries";
import { recordMessageAction, setMessagesOptOutAction } from "../actions";

const SECTION_ORDER = ["Promessas para hoje", "Em atraso", "Vencem hoje", "Lembretes de vencimento", "Agradecimentos"];
const SKIP_REASONS = ["Cliente já avisou que vai pagar", "Já falei com o cliente hoje", "Pagamento em conferência", "Vou cobrar pessoalmente"];

export function QueueView({ items, today }: { items: RenderedQueueItem[]; today: string }) {
  const [done, setDone] = useState<Set<string>>(new Set());
  const visible = items.filter((i) => !done.has(i.key));
  const sections = useMemo(() => {
    const map = new Map<string, RenderedQueueItem[]>();
    for (const it of visible) {
      const s = KIND_META[it.kind].section;
      map.set(s, [...(map.get(s) ?? []), it]);
    }
    return SECTION_ORDER.filter((s) => map.has(s)).map((s) => ({ title: s, items: map.get(s)! }));
  }, [visible]);
  const markDone = (key: string) => setDone((d) => new Set(d).add(key));
  const initial = useEnterInitial();

  if (!visible.length) {
    return (
      <Card>
        <EmptyState
          icon={<PartyPopper className="h-5 w-5" />}
          title={items.length ? "Fila concluída!" : "Nenhuma mensagem para hoje"}
          description={
            items.length
              ? "Todas as mensagens de hoje foram tratadas. Os envios estão no histórico de cada cliente."
              : `Ninguém precisa de lembrete em ${formatDate(today)}. A fila é montada automaticamente todos os dias.`
          }
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {sections.map((sec) => (
        <section key={sec.title}>
          <h2 className="mb-3 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
            {sec.title} <span className="tabular rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-fg">{sec.items.length}</span>
          </h2>
          <motion.ul className="grid grid-cols-1 gap-3 lg:grid-cols-2" initial={initial} animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}>
            <AnimatePresence initial={false}>
              {sec.items.map((it) => (
                <motion.li key={it.key} className="min-w-0" variants={listItem} exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.18 } }} layout="position">
                  <MessageCard item={it} onDone={() => markDone(it.key)} />
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
        </section>
      ))}
    </div>
  );
}

function MessageCard({ item, onDone }: { item: RenderedQueueItem; onDone: () => void }) {
  const router = useRouter();
  const meta = KIND_META[item.kind];
  const [body, setBody] = useState(item.body);
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [awaiting, setAwaiting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [skipOpen, setSkipOpen] = useState(false);
  const [optOutOpen, setOptOutOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const link = whatsappLink(item.customer.phone, body);

  async function record(status: "sent" | "skipped", skipReason: string | null = null) {
    setSaving(true);
    const r = await recordMessageAction({
      customerId: item.customer.id,
      kind: item.kind,
      status,
      body,
      amount: item.amount,
      installments: item.installments.map((i) => ({ id: i.id, ref_date: i.ref_date })),
      promiseId: item.promiseId,
      paymentId: item.paymentId,
      refDate: item.refDate,
      skipReason,
    });
    setSaving(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success(r.message);
    onDone();
    router.refresh();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(body);
      toast.success("Mensagem copiada.");
    } catch {
      toast.error("Não foi possível copiar. Selecione o texto manualmente.");
    }
  }

  return (
    <Card className={cn("overflow-hidden transition-colors", awaiting && "border-success/40")}>
      <div className="flex items-start gap-3 p-4">
        <Avatar name={item.customer.full_name} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link href={`/clientes/${item.customer.id}`} className="block truncate text-[15px] font-semibold text-fg hover:text-bronze">
                {item.customer.full_name}
              </Link>
              <p className="truncate text-[12px] text-fg-muted">
                {[item.customer.city_name, formatPhone(item.customer.phone)].filter(Boolean).join(" · ")}
              </p>
            </div>
            <div className="relative shrink-0">
              <button
                type="button"
                aria-label="Mais opções"
                onClick={() => setMenuOpen((o) => !o)}
                className="-mr-2 -mt-1 inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-fg-muted hover:bg-white/5 hover:text-fg"
              >
                <MoreHorizontal className="h-5 w-5" />
              </button>
              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
                    className="absolute right-0 top-11 z-20 w-56 overflow-hidden rounded-xl border border-line-strong bg-bg-elevated shadow-pop"
                    onMouseLeave={() => setMenuOpen(false)}
                  >
                    <MenuButton icon={<SkipForward className="h-4 w-4" />} onClick={() => { setMenuOpen(false); setSkipOpen(true); }}>Pular esta mensagem</MenuButton>
                    <MenuButton icon={<BellOff className="h-4 w-4" />} onClick={() => { setMenuOpen(false); setOptOutOpen(true); }}>Cliente não quer receber</MenuButton>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone={meta.tone}>{meta.short}</Badge>
            <span className="money text-[15px] font-semibold text-fg">{formatBRL(item.amount)}</span>
            {item.dueDate && item.kind !== "thanks" && (
              <span className="text-[12px] text-fg-muted">
                {item.daysOverdue > 0 ? `venceu em ${formatDate(item.dueDate)} · ${item.daysOverdue} dias` : `vence ${formatDate(item.dueDate)}`}
              </span>
            )}
            {item.installments.length > 1 && <span className="text-[12px] text-fg-muted">{item.installments.length} parcelas</span>}
          </div>
        </div>
      </div>

      {/* Prévia / edição do texto */}
      <div className="px-4">
        {editing ? (
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} aria-label="Texto da mensagem" className="text-[13px]" />
        ) : (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="block w-full cursor-pointer rounded-xl border border-line bg-bg-elevated px-3.5 py-3 text-left"
            aria-expanded={expanded}
          >
            <p className={cn("whitespace-pre-wrap text-[13px] leading-relaxed text-fg-muted [overflow-wrap:anywhere]", !expanded && "line-clamp-4")}>{body}</p>
            <span className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-medium text-bronze">
              {expanded ? "Recolher" : "Ver mensagem completa"} <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} />
            </span>
          </button>
        )}
        <div className="mt-2 flex gap-1">
          <button type="button" onClick={() => setEditing((e) => !e)} className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-medium text-fg-muted hover:bg-white/5 hover:text-fg">
            {editing ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />} {editing ? "Concluir edição" : "Editar texto"}
          </button>
          <button type="button" onClick={copy} className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-medium text-fg-muted hover:bg-white/5 hover:text-fg">
            <Copy className="h-3.5 w-3.5" /> Copiar
          </button>
        </div>
      </div>

      {/* Ações */}
      <div className="mt-2 border-t border-line p-3">
        <AnimatePresence mode="wait" initial={false}>
          {awaiting ? (
            <motion.div key="confirm" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }} className="space-y-2">
              <p className="text-center text-[13px] text-fg-muted">Enviou a mensagem no WhatsApp?</p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="ghost" onClick={() => setAwaiting(false)} disabled={saving}>
                  <X className="h-4 w-4" /> Não enviei
                </Button>
                <Button variant="success" onClick={() => record("sent")} loading={saving}>
                  {!saving && <Check className="h-4 w-4" />} Enviada
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="send" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}>
              {link ? (
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setTimeout(() => setAwaiting(true), 400)}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-success text-[15px] font-semibold text-[#052e16] transition-transform active:scale-[0.98]"
                >
                  <MessageCircle className="h-5 w-5" /> Abrir WhatsApp
                </a>
              ) : (
                <p className="text-center text-[13px] text-danger-fg">Telefone inválido — corrija o cadastro do cliente.</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <SkipDialog open={skipOpen} onClose={() => setSkipOpen(false)} onConfirm={async (reason) => { await record("skipped", reason); setSkipOpen(false); }} />
      <OptOutDialog
        open={optOutOpen}
        name={item.customer.full_name}
        onClose={() => setOptOutOpen(false)}
        onConfirm={async (reason) => {
          const r = await setMessagesOptOutAction({ customerId: item.customer.id, optOut: true, reason });
          if (!r.ok) {
            toast.error(r.error);
            return;
          }
          toast.success(r.message);
          setOptOutOpen(false);
          onDone();
          router.refresh();
        }}
      />
    </Card>
  );
}

function MenuButton({ icon, children, onClick }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-11 w-full cursor-pointer items-center gap-2.5 px-3.5 text-left text-[13px] text-fg hover:bg-white/[0.05]">
      <span className="text-fg-muted">{icon}</span>
      {children}
    </button>
  );
}

function ReasonDialog({
  open, onClose, onConfirm, title, description, confirmLabel, suggestions, tone = "primary",
}: {
  open: boolean; onClose: () => void; onConfirm: (reason: string) => Promise<void>; title: string; description: string;
  confirmLabel: string; suggestions: string[]; tone?: "primary" | "danger";
}) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  return (
    <Modal
      open={open}
      onClose={() => !loading && onClose()}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>Voltar</Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            loading={loading}
            disabled={reason.trim().length < 3}
            onClick={async () => { setLoading(true); await onConfirm(reason.trim()); setLoading(false); setReason(""); }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="mb-3 flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <button key={s} type="button" onClick={() => setReason(s)} className={cn("min-h-9 cursor-pointer rounded-full border px-3 text-[12px] transition-colors", reason === s ? "border-bronze bg-bronze-soft text-bronze" : "border-line text-fg-muted hover:text-fg")}>
            {s}
          </button>
        ))}
      </div>
      <Field label="Motivo" required>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Descreva o motivo" />
      </Field>
    </Modal>
  );
}

function SkipDialog(props: { open: boolean; onClose: () => void; onConfirm: (reason: string) => Promise<void> }) {
  return <ReasonDialog {...props} title="Pular esta mensagem" description="Esta etapa não volta para a fila. O motivo fica no histórico do cliente." confirmLabel="Pular" suggestions={SKIP_REASONS} />;
}

function OptOutDialog({ name, ...props }: { open: boolean; name: string; onClose: () => void; onConfirm: (reason: string) => Promise<void> }) {
  return (
    <ReasonDialog
      {...props}
      tone="danger"
      title="Não enviar mais mensagens"
      description={`${name} não aparecerá mais na fila de mensagens. Dá para reativar na ficha do cliente.`}
      confirmLabel="Confirmar"
      suggestions={["Cliente pediu para não receber", "Prefere ser cobrado pessoalmente", "Número não é do cliente"]}
    />
  );
}

export function kindLabel(k: MessageKind) {
  return KIND_META[k].short;
}
