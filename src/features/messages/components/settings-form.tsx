"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, MessageSquareText, QrCode, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import { Segmented } from "@/components/ui/tabs";
import { todayISO, addDays } from "@/lib/dates";
import { buildPixPayload, normalizePixKey } from "@/lib/pix";
import { cn } from "@/lib/utils";
import { DEFAULT_TEMPLATES, KIND_META, TEMPLATE_VARIABLES, renderTemplate, type MessageKind, type MessageSettings } from "../config";
import { updateMessageSettingsAction } from "../actions";

/** Ordem cronológica para exibição (a fila usa a ordem de prioridade de MESSAGE_KINDS). */
const CALENDAR_ORDER: MessageKind[] = ["before_due", "due_today", "overdue_3", "overdue_7", "overdue_15", "promise", "thanks"];

const STEP_LABELS: Record<MessageKind, string> = {
  before_due: "Lembrete antes do vencimento",
  due_today: "No dia do vencimento",
  overdue_3: "3 dias de atraso",
  overdue_7: "7 dias de atraso",
  overdue_15: "15 dias de atraso (última mensagem; depois, contato pessoal)",
  promise: "No dia combinado de uma promessa",
  thanks: "Agradecimento após pagamento confirmado",
};

export function MessageSettingsForm({ initial, company }: { initial: MessageSettings; company: string }) {
  const router = useRouter();
  const [s, setS] = useState<MessageSettings>(initial);
  const [kind, setKind] = useState<MessageKind>("overdue_3");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);

  const text = s.templates[kind]?.trim() ? s.templates[kind] : DEFAULT_TEMPLATES[kind];
  const setText = (v: string) => setS((p) => ({ ...p, templates: { ...p.templates, [kind]: v } }));
  const pixValid = normalizePixKey(s.pix.key);

  const preview = useMemo(() => {
    let pix: string | null = null;
    try {
      if (pixValid && kind !== "thanks") pix = buildPixPayload({ key: pixValid.key, name: s.pix.name, city: s.pix.city, amount: 150, txid: "V12P3" });
    } catch {}
    return renderTemplate(text, { fullName: "Maria Santos", company, amount: 150, dueDate: addDays(todayISO(), kind === "before_due" ? 3 : -9), daysOverdue: 9, balance: 450, pixCode: pix }, kind);
  }, [text, kind, s.pix, pixValid, company]);

  function insertVar(v: string) {
    const el = ta.current;
    const token = `{${v}}`;
    if (!el) return setText(text + token);
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    setText(text.slice(0, start) + token + text.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  async function save() {
    setSaving(true);
    // textos iguais ao padrão não são gravados (assim melhorias futuras do padrão chegam automaticamente)
    const templates = Object.fromEntries(Object.entries(s.templates).filter(([k, v]) => v.trim() && v.trim() !== DEFAULT_TEMPLATES[k as MessageKind]));
    const r = await updateMessageSettingsAction({ ...s, templates });
    setSaving(false);
    if (!r.ok) {
      setErrors(r.fieldErrors ?? {});
      return toast.error(r.error);
    }
    setErrors({});
    toast.success(r.message);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:items-start">
        <Card>
          <CardHeader icon={<CalendarClock className="h-4 w-4" />} title="Calendário de mensagens" description="Quando cada mensagem entra na fila do dia. No máximo uma por cliente por dia." />
          <CardBody className="space-y-2.5">
            <Checkbox
              checked={s.enabled}
              onChange={(v) => setS((p) => ({ ...p, enabled: v }))}
              label="Mensagens de cobrança ativadas"
              description="Desligado, a fila do dia fica vazia."
            />
            <div className={cn("space-y-2.5", !s.enabled && "pointer-events-none opacity-50")}>
              {CALENDAR_ORDER.map((k) => (
                <div key={k} className="flex flex-wrap items-center gap-2">
                  <Checkbox
                    className="flex-1"
                    checked={s.steps[k].enabled}
                    onChange={(v) => setS((p) => ({ ...p, steps: { ...p.steps, [k]: { ...p.steps[k], enabled: v } } }))}
                    label={STEP_LABELS[k]}
                  />
                  {k === "before_due" && (
                    <div className="flex items-center gap-2 text-[13px] text-fg-muted">
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={10}
                        aria-label="Dias antes do vencimento"
                        value={s.steps.before_due.days}
                        onChange={(e) => setS((p) => ({ ...p, steps: { ...p.steps, before_due: { ...p.steps.before_due, days: Number(e.target.value) || 1 } } }))}
                        className="w-20 text-center"
                      />
                      dias antes
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader icon={<QrCode className="h-4 w-4" />} title="Pix nas mensagens" description="Cada mensagem leva um Pix copia e cola com o valor exato da cobrança." />
          <CardBody className="space-y-4">
            <Field label="Chave Pix da empresa" error={errors["pix.key"]} hint={pixValid ? `Chave reconhecida como ${{ cpf: "CPF", cnpj: "CNPJ", phone: "celular", email: "e-mail", random: "chave aleatória" }[pixValid.type]}.` : "CPF, CNPJ, e-mail, celular ou chave aleatória."}>
              <Input value={s.pix.key ?? ""} onChange={(e) => setS((p) => ({ ...p, pix: { ...p.pix, key: e.target.value } }))} placeholder="ex.: 12.345.678/0001-95" autoComplete="off" />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Nome do recebedor" required error={errors["pix.name"]} hint="Como aparece no app do banco (até 25 letras).">
                <Input value={s.pix.name} maxLength={25} onChange={(e) => setS((p) => ({ ...p, pix: { ...p.pix, name: e.target.value } }))} />
              </Field>
              <Field label="Cidade" required error={errors["pix.city"]} hint="Até 15 letras.">
                <Input value={s.pix.city} maxLength={15} onChange={(e) => setS((p) => ({ ...p, pix: { ...p.pix, city: e.target.value } }))} />
              </Field>
            </div>
            <p className="text-[12px] leading-relaxed text-fg-subtle">
              O código é gerado pelo próprio sistema no padrão do Banco Central, sem integração bancária. O pagamento continua sendo confirmado na Central de Cobranças.
            </p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader icon={<MessageSquareText className="h-4 w-4" />} title="Textos das mensagens" description="Toque numa variável para inserir. Use *texto* para negrito no WhatsApp." />
        <CardBody className="space-y-4">
          <Segmented<MessageKind> value={kind} onChange={setKind} options={CALENDAR_ORDER.map((k) => ({ value: k, label: KIND_META[k].short }))} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Field label={`Texto — ${KIND_META[kind].label}`} error={errors[`templates.${kind}`]}>
                <Textarea ref={ta} value={text} onChange={(e) => setText(e.target.value)} rows={11} className="text-[13px]" />
              </Field>
              <div className="flex flex-wrap gap-1.5">
                {TEMPLATE_VARIABLES.filter((v) => kind === "thanks" || v.key !== "saldo_bloco").map((v) => (
                  <button key={v.key} type="button" title={v.description} onClick={() => insertVar(v.key)} className="min-h-9 cursor-pointer rounded-full border border-line px-2.5 font-mono text-[11.5px] text-bronze hover:bg-bronze-soft">
                    {`{${v.key}}`}
                  </button>
                ))}
              </div>
              {s.templates[kind]?.trim() && s.templates[kind] !== DEFAULT_TEMPLATES[kind] && (
                <button type="button" onClick={() => setText(DEFAULT_TEMPLATES[kind])} className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-[12px] font-medium text-fg-muted hover:text-fg">
                  <RotateCcw className="h-3.5 w-3.5" /> Restaurar texto padrão
                </button>
              )}
            </div>
            <div>
              <p className="mb-1.5 text-[13px] font-medium text-fg-muted">Prévia (exemplo)</p>
              <div className="rounded-2xl rounded-tl-sm border border-success/25 bg-success-soft p-3.5">
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-fg [overflow-wrap:anywhere]">{preview}</p>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} loading={saving} size="lg">Salvar configurações</Button>
      </div>
    </div>
  );
}
