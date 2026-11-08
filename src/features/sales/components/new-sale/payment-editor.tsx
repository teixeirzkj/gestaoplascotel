"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Shuffle } from "lucide-react";
import { Checkbox, Field, Input, MoneyInput, Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/tabs";
import { SwapContent } from "@/components/ui/motion-list";
import { formatBRL } from "@/lib/format";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/labels";
import { fade } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { INTERVAL_OPTIONS, type IntervalKey } from "../../calc";
import type { Computed, Draft, SaleMode, StepErrors } from "./draft";

const COUNT_OPTIONS = Array.from({ length: 36 }, (_, i) => i + 1);

function MethodSelect({ value, onChange, label }: { value: PaymentMethod; onChange: (m: PaymentMethod) => void; label: string }) {
  return (
    <Field label={label}>
      <Select value={value} onChange={(e) => onChange(e.target.value as PaymentMethod)}>
        {PAYMENT_METHODS.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </Select>
    </Field>
  );
}

export function PaymentEditor({
  draft,
  computed,
  errors,
  update,
  onChangeRow,
  onRedistribute,
}: {
  draft: Draft;
  computed: Computed;
  errors: StepErrors;
  update: (patch: Partial<Draft>) => void;
  onChangeRow: (index: number, patch: { amountCents?: number; dueDate?: string }) => void;
  onRedistribute: () => void;
}) {
  const c = computed;
  const total = c.totalCents / 100;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Forma de pagamento" hint="Como o cliente costuma pagar.">
          <Select value={draft.paymentMethod} onChange={(e) => update({ paymentMethod: e.target.value as PaymentMethod | "" })}>
            <option value="">Não informada</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Condições" hint="Texto livre, aparece no detalhe da venda.">
          <Input
            value={draft.conditions}
            maxLength={500}
            onChange={(e) => update({ conditions: e.target.value })}
            placeholder="Ex.: pagamento todo dia 10"
            autoComplete="off"
          />
        </Field>
      </div>

      <div>
        <p className="mb-2 text-[13px] font-medium text-fg-muted">Modalidade</p>
        <Segmented<SaleMode>
          value={draft.mode}
          onChange={(mode) => update({ mode })}
          options={[
            { value: "avista", label: "À vista" },
            { value: "parcelado", label: "Parcelado" },
          ]}
        />
      </div>

      <SwapContent id={draft.mode}>
        {draft.mode === "avista" ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-2xl border border-line bg-bg-elevated px-4 py-3.5">
              <span className="text-sm text-fg-muted">Valor à vista</span>
              <span className="money text-[19px] font-semibold text-fg">{formatBRL(total)}</span>
            </div>
            <Checkbox
              label="Recebido agora"
              description={
                draft.cashReceived
                  ? "O pagamento entra confirmado no caixa de hoje e a venda já fica quitada."
                  : "Fica como cobrança em aberto com vencimento na data da venda."
              }
              checked={draft.cashReceived}
              onChange={(cashReceived) => update({ cashReceived })}
            />
            <AnimatePresence initial={false}>
              {draft.cashReceived && (
                <motion.div variants={fade} initial="hidden" animate="show" exit="exit" className="sm:max-w-xs">
                  <MethodSelect label="Forma do recebimento" value={draft.cashMethod} onChange={(cashMethod) => update({ cashMethod })} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Entrada" hint="Opcional. Deixe em branco se não houver." error={errors.down}>
                <MoneyInput value={draft.down} onValueChange={(down) => update({ down, customRows: null })} />
              </Field>
              <AnimatePresence initial={false}>
                {c.downCents > 0 && (
                  <motion.div variants={fade} initial="hidden" animate="show" exit="exit">
                    <MethodSelect label="Forma da entrada" value={draft.downMethod} onChange={(downMethod) => update({ downMethod })} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <AnimatePresence initial={false}>
              {c.downCents > 0 && (
                <motion.div variants={fade} initial="hidden" animate="show" exit="exit">
                  <Checkbox
                    label="Entrada recebida agora"
                    description={draft.downReceived ? "Entra confirmada no caixa de hoje." : "Fica como cobrança com vencimento na data da venda."}
                    checked={draft.downReceived}
                    onChange={(downReceived) => update({ downReceived })}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Nº de parcelas" error={errors.count}>
                <Select value={String(draft.count)} onChange={(e) => update({ count: Number(e.target.value), customRows: null })}>
                  {COUNT_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}x
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Intervalo">
                <Select
                  value={draft.interval}
                  onChange={(e) => update({ interval: e.target.value as IntervalKey, customRows: null })}
                >
                  {INTERVAL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="1º vencimento" className="col-span-2 sm:col-span-1">
                <Input
                  type="date"
                  value={c.firstDue}
                  min={draft.saleDate || undefined}
                  onChange={(e) => update({ firstDue: e.target.value || null, customRows: null })}
                />
              </Field>
            </div>

            <div className="rounded-2xl border border-line bg-bg-elevated">
              <div className="flex items-center justify-between gap-3 border-b border-line px-3.5 py-3 sm:px-4">
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-fg">Parcelas</p>
                  <p className="text-[12px] text-fg-muted">
                    A parcelar: <span className="money font-medium text-fg">{formatBRL(c.baseCents / 100)}</span> · edite valores e datas se precisar
                  </p>
                </div>
                {draft.customRows && (
                  <Button variant="ghost" size="sm" onClick={() => update({ customRows: null })} className="shrink-0">
                    Restaurar
                  </Button>
                )}
              </div>
              <ol className="divide-y divide-line">
                <AnimatePresence initial={false}>
                  {c.rows.map((r, i) => (
                    <motion.li
                      key={i}
                      layout="position"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0, transition: { duration: 0.2, delay: Math.min(i, 12) * 0.03 } }}
                      exit={{ opacity: 0, transition: { duration: 0.12 } }}
                      className="grid grid-cols-[34px_minmax(0,1fr)_minmax(0,1fr)] items-start gap-2 px-3.5 py-2.5 sm:grid-cols-[44px_minmax(0,1fr)_minmax(0,1fr)] sm:gap-3 sm:px-4"
                    >
                      <span className="tabular flex h-11 items-center text-[13px] font-semibold text-bronze">{i + 1}ª</span>
                      <div className="min-w-0">
                        <MoneyInput
                          aria-label={`Valor da parcela ${i + 1}`}
                          aria-invalid={errors[`row.${i}.amount`] ? true : undefined}
                          value={r.amountCents / 100}
                          onValueChange={(v) => onChangeRow(i, { amountCents: Math.round(v * 100) })}
                        />
                        {errors[`row.${i}.amount`] && <p className="mt-1 text-[11.5px] font-medium text-danger-fg">{errors[`row.${i}.amount`]}</p>}
                      </div>
                      <div className="min-w-0">
                        <Input
                          type="date"
                          aria-label={`Vencimento da parcela ${i + 1}`}
                          aria-invalid={errors[`row.${i}.dueDate`] ? true : undefined}
                          value={r.dueDate}
                          onChange={(e) => onChangeRow(i, { dueDate: e.target.value })}
                          className="tabular px-2.5 sm:px-3.5"
                        />
                        {errors[`row.${i}.dueDate`] && <p className="mt-1 text-[11.5px] font-medium text-danger-fg">{errors[`row.${i}.dueDate`]}</p>}
                      </div>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ol>
              <DiffIndicator diffCents={c.diffCents} onRedistribute={onRedistribute} error={errors.rows} />
            </div>
          </div>
        )}
      </SwapContent>

      <Field label="Observações">
        <Textarea
          value={draft.notes}
          maxLength={2000}
          onChange={(e) => update({ notes: e.target.value })}
          placeholder="Informações internas sobre a venda (opcional)"
        />
      </Field>
    </div>
  );
}

function DiffIndicator({ diffCents, onRedistribute, error }: { diffCents: number; onRedistribute: () => void; error?: string }) {
  const ok = diffCents === 0;
  return (
    <div
      aria-live="polite"
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 rounded-b-2xl border-t px-3.5 py-3 sm:px-4",
        ok ? "border-line bg-success-soft/40" : "border-warning/30 bg-warning-soft",
      )}
    >
      <span className={cn("inline-flex items-center gap-2 text-[13px] font-medium", ok ? "text-success" : "text-warning")}>
        {ok ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <AlertTriangle className="h-4 w-4" aria-hidden />}
        {ok ? (
          "Soma das parcelas confere com o valor a parcelar"
        ) : (
          <span>
            {diffCents > 0 ? "Sobram " : "Faltam "}
            <span className="money">{formatBRL(Math.abs(diffCents) / 100)}</span> na soma das parcelas
          </span>
        )}
      </span>
      {!ok && (
        <Button variant="secondary" size="sm" onClick={onRedistribute}>
          <Shuffle className="h-4 w-4" /> Redistribuir
        </Button>
      )}
      {!ok && error && <span className="sr-only">{error}</span>}
    </div>
  );
}
