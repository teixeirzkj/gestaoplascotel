import { ClipboardList, MessageSquareText, NotebookPen, PhoneCall, HandCoins, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { MotionItem, MotionList } from "@/components/ui/motion-list";
import { EmptyState } from "@/components/ui/states";
import { NOTE_KIND } from "@/lib/labels";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CustomerNoteItem } from "../types";
import { NoteForm } from "./note-form";

const KIND_META: Record<string, { icon: LucideIcon; cls: string; tone: "brand" | "info" | "warning" }> = {
  note: { icon: NotebookPen, cls: "bg-bronze-soft text-bronze", tone: "brand" },
  contact: { icon: PhoneCall, cls: "bg-info-soft text-info", tone: "info" },
  collection: { icon: HandCoins, cls: "bg-warning-soft text-warning", tone: "warning" },
};

export function NotesTab({ customerId, registrationNotes, notes }: { customerId: string; registrationNotes: string | null; notes: CustomerNoteItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] xl:items-start">
      <div className="space-y-4 xl:sticky xl:top-20">
        <Card>
          <CardHeader title="Nova anotação" description="Fica registrada com seu nome, data e hora." icon={<MessageSquareText className="h-4 w-4" />} />
          <CardBody>
            <NoteForm customerId={customerId} />
          </CardBody>
        </Card>
        {registrationNotes && (
          <div className="rounded-2xl bg-paper p-4 text-paper-ink shadow-card sm:p-5">
            <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-paper-muted">
              <ClipboardList className="h-3.5 w-3.5" aria-hidden /> Observação do cadastro
            </p>
            <p className="mt-2 whitespace-pre-line break-words text-[14px] leading-relaxed">{registrationNotes}</p>
          </div>
        )}
      </div>

      <Card>
        <CardHeader title="Anotações" description={notes.length ? `${notes.length} registro${notes.length > 1 ? "s" : ""}` : undefined} />
        <CardBody className="pt-3 sm:pt-3">
          {notes.length === 0 ? (
            <EmptyState compact icon={<NotebookPen className="h-5 w-5" />} title="Nenhuma anotação ainda" description="Registre contatos, cobranças e informações úteis para a equipe." />
          ) : (
            <MotionList as="ul" className="divide-y divide-line">
              {notes.map((n) => {
                const meta = KIND_META[n.kind] ?? KIND_META.note;
                const Icon = meta.icon;
                return (
                  <MotionItem as="li" key={n.id} className="flex gap-3 py-3.5 first:pt-1 last:pb-0">
                    <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", meta.cls)}>
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Badge tone={meta.tone} dot={false}>
                          {NOTE_KIND[n.kind] ?? n.kind}
                        </Badge>
                        <span className="text-[12px] text-fg-subtle">
                          {n.author_name ?? "—"} · <span className="tabular">{formatDateTime(n.created_at)}</span>
                        </span>
                      </div>
                      <p className="mt-1.5 whitespace-pre-line break-words text-[14px] leading-relaxed text-fg">{n.body}</p>
                    </div>
                  </MotionItem>
                );
              })}
            </MotionList>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
