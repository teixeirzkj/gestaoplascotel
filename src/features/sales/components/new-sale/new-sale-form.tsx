"use client";

import { useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, MoneyInput, Select } from "@/components/ui/field";
import { formatBRL } from "@/lib/format";
import { splitCents } from "@/lib/money";
import { ease } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { ActiveProductOption } from "@/features/products/queries";
import { createSale } from "../../actions";
import type { IntervalKey } from "../../calc";
import type { CityOption, CustomerOption } from "../../queries";
import { CustomerPicker } from "./customer-picker";
import { ItemsEditor } from "./items-editor";
import { PaymentEditor } from "./payment-editor";
import { SaleSummary } from "./sale-summary";
import { STEPS, Stepper } from "./stepper";
import {
  buildPayload,
  computeDraft,
  emptyItem,
  initialDraft,
  validateStep,
  type Draft,
  type ItemDraft,
  type StepErrors,
} from "./draft";

type Props = {
  /** Cliente pré-selecionado (?cliente=<id>), já validado como ativo no servidor. */
  initialCustomer: CustomerOption | null;
  /** Há clientes ativos cadastrados? (mensagem de estado vazio do seletor) */
  hasCustomers: boolean;
  products: ActiveProductOption[];
  cities: CityOption[];
  today: string;
  idempotencyKey: string;
  /** Intervalo padrão das parcelas (Configurações > Cobrança). */
  defaultInterval: IntervalKey;
};

const DESKTOP_QUERY = "(min-width: 1024px)";

function useIsDesktop() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(DESKTOP_QUERY);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false,
  );
}

const slide: Variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 28 }),
  center: { opacity: 1, x: 0, transition: { duration: 0.26, ease: ease.out } },
  exit: (dir: number) => ({ opacity: 0, x: dir * -20, transition: { duration: 0.16, ease: ease.in } }),
};

type FormStep = 1 | 2 | 3;

export function NewSaleForm({ initialCustomer, hasCustomers, products, cities, today, idempotencyKey, defaultInterval }: Props) {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const [draft, setDraft] = useState<Draft>(() => initialDraft(today, initialCustomer, defaultInterval));
  const [step, setStep] = useState(1);
  const [maxReached, setMaxReached] = useState(1);
  const [dir, setDir] = useState(1);
  const [attempted, setAttempted] = useState<Record<FormStep, boolean>>({ 1: false, 2: false, 3: false });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const itemSeq = useRef(1);

  const computed = useMemo(() => computeDraft(draft), [draft]);
  const errorsFor = (s: FormStep): StepErrors => (attempted[s] ? validateStep(s, draft, computed, today) : {});
  const e1 = errorsFor(1);
  const e2 = errorsFor(2);
  const e3 = errorsFor(3);

  function update(patch: Partial<Draft>) {
    setSubmitError(null);
    setDraft((d) => ({ ...d, ...patch }));
  }
  function changeItem(key: string, patch: Partial<ItemDraft>) {
    setSubmitError(null);
    setDraft((d) => ({ ...d, customRows: null, items: d.items.map((it) => (it.key === key ? { ...it, ...patch } : it)) }));
  }
  function addItem() {
    itemSeq.current += 1;
    const key = `item-${itemSeq.current}`;
    setDraft((d) => ({ ...d, customRows: null, items: [...d.items, emptyItem(key)] }));
  }
  function removeItem(key: string) {
    setDraft((d) => ({ ...d, customRows: null, items: d.items.filter((it) => it.key !== key) }));
  }
  /** Última parcela cujo valor foi digitado: "Redistribuir" a mantém e divide a diferença entre as demais. */
  const lastEditedRow = useRef<number | null>(null);
  function changeRow(index: number, patch: { amountCents?: number; dueDate?: string }) {
    setSubmitError(null);
    if (patch.amountCents !== undefined) lastEditedRow.current = index;
    setDraft((d) => {
      const base = computeDraft(d).rows;
      return { ...d, customRows: base.map((r, i) => (i === index ? { ...r, ...patch } : r)) };
    });
  }
  function redistribute() {
    const fixed = lastEditedRow.current;
    setDraft((d) => {
      const c = computeDraft(d);
      const n = c.rows.length;
      const fixedCents = fixed !== null && fixed < n ? c.rows[fixed].amountCents : null;
      // Mantém o valor digitado se sobrar ao menos 1 centavo para cada uma das outras parcelas;
      // caso contrário (ou sem edição de valor), volta à divisão igual.
      if (fixedCents !== null && n > 1 && fixedCents > 0 && c.baseCents - fixedCents >= n - 1) {
        const others = splitCents(c.baseCents - fixedCents, n - 1);
        let k = 0;
        return { ...d, customRows: c.rows.map((r, i) => ({ ...r, amountCents: i === fixed ? fixedCents : others[k++] })) };
      }
      const amounts = splitCents(c.baseCents, n);
      return { ...d, customRows: c.rows.map((r, i) => ({ ...r, amountCents: amounts[i] })) };
    });
  }

  function isValid(s: FormStep) {
    return Object.keys(validateStep(s, draft, computed, today)).length === 0;
  }

  function goTo(next: number) {
    setDir(next > step ? 1 : -1);
    setStep(next);
    setMaxReached((m) => Math.max(m, next));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function focusFirstError() {
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>('[data-sale-form] [aria-invalid="true"]');
      el?.focus({ preventScroll: true });
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function next() {
    if (step <= 3) {
      const s = step as FormStep;
      setAttempted((a) => ({ ...a, [s]: true }));
      if (!isValid(s)) {
        toast.error("Corrija os campos destacados para continuar.");
        focusFirstError();
        return;
      }
    }
    goTo(Math.min(4, step + 1));
  }

  function submit() {
    if (pending || done) return;
    setAttempted({ 1: true, 2: true, 3: true });
    const firstInvalid = ([1, 2, 3] as FormStep[]).find((s) => !isValid(s));
    if (firstInvalid) {
      toast.error("Revise os dados destacados antes de confirmar.");
      if (!isDesktop) goTo(firstInvalid);
      focusFirstError();
      return;
    }
    const payload = buildPayload(draft, computed, products, idempotencyKey);
    setSubmitError(null);
    startTransition(async () => {
      const r = await createSale(payload);
      if (!r.ok) {
        setSubmitError(r.error);
        toast.error(r.error);
        return;
      }
      setDone(true);
      toast.success(r.message ?? "Venda registrada.");
      router.push(`/vendas/${r.data.id}`);
    });
  }

  const busy = pending || done;

  /* -------- Seções -------- */
  const customerSection = (
    <div className="space-y-4">
      <div>
        <p className="mb-1.5 text-[13px] font-medium text-fg-muted">
          Cliente<span className="ml-0.5 text-bronze" aria-hidden>*</span>
        </p>
        <CustomerPicker
          hasCustomers={hasCustomers}
          value={draft.customer}
          error={e1.customer}
          onChange={(customer) => update({ customer, cityId: customer?.city_id ?? "" })}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Cidade da venda" hint="Padrão: cidade do cliente.">
          <Select value={draft.cityId} onChange={(e) => update({ cityId: e.target.value })}>
            <option value="">Sem cidade</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}/{c.state}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Data da venda" required error={e1.saleDate}>
          <Input type="date" max={today} value={draft.saleDate} onChange={(e) => update({ saleDate: e.target.value })} />
        </Field>
      </div>
    </div>
  );

  const itemsSection = (
    <div className="space-y-4">
      {products.length === 0 && (
        <p className="rounded-xl border border-line bg-bg-elevated px-3.5 py-3 text-[13px] text-fg-muted">
          Nenhum produto ativo cadastrado. Use “Item avulso” ou cadastre produtos em Produtos.
        </p>
      )}
      <ItemsEditor
        items={draft.items}
        products={products}
        computed={computed}
        errors={e2}
        onChangeItem={changeItem}
        onAdd={addItem}
        onRemove={removeItem}
      />
      <div className="grid gap-3 rounded-2xl border border-line bg-card p-3.5 sm:grid-cols-[1fr_auto] sm:items-end sm:p-4">
        <Field label="Desconto geral" error={e2.discount} className="sm:max-w-[240px]">
          <MoneyInput value={draft.discount} onValueChange={(discount) => update({ discount, customRows: null })} />
        </Field>
        <div className="text-right">
          <p className="text-[12px] text-fg-muted">
            Subtotal <span className="money">{formatBRL(computed.subtotalCents / 100)}</span>
          </p>
          <p className="text-[13px] text-fg-muted">Total da venda</p>
          <p className={cn("money text-[24px] font-semibold leading-tight", computed.totalCents <= 0 ? "text-fg-subtle" : "text-fg")}>
            {formatBRL(Math.max(0, computed.totalCents) / 100)}
          </p>
        </div>
      </div>
      {e2.total && (
        <p role="alert" className="text-[12px] font-medium text-danger-fg">
          {e2.total}
        </p>
      )}
    </div>
  );

  const paymentSection = (
    <PaymentEditor draft={draft} computed={computed} errors={e3} update={update} onChangeRow={changeRow} onRedistribute={redistribute} />
  );

  const errorBanner = submitError && (
    <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger-soft px-3.5 py-3 text-[13px] text-fg">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger-fg" aria-hidden />
      <span>{submitError}</span>
    </div>
  );

  /* -------- Desktop: duas colunas -------- */
  if (isDesktop) {
    return (
      <div data-sale-form className="grid grid-cols-[minmax(0,1fr)_minmax(320px,380px)] items-start gap-6">
        <div className="space-y-5">
          <Card>
            <CardHeader title="1. Cliente" description="Quem comprou, onde e quando." />
            <CardBody>{customerSection}</CardBody>
          </Card>
          <Card>
            <CardHeader title="2. Produtos" description="Itens, quantidades e descontos." />
            <CardBody>{itemsSection}</CardBody>
          </Card>
          <Card>
            <CardHeader title="3. Pagamento" description="À vista ou parcelado, com parcelas editáveis." />
            <CardBody>{paymentSection}</CardBody>
          </Card>
        </div>
        <aside className="sticky top-20 space-y-3">
          <Card>
            <CardHeader title="Resumo" description="Confira antes de confirmar." />
            <CardBody>
              <SaleSummary draft={draft} computed={computed} products={products} cities={cities} variant="aside" />
            </CardBody>
          </Card>
          {errorBanner}
          <Button size="lg" className="w-full" onClick={submit} loading={busy} disabled={busy}>
            {!busy && <Check className="h-4 w-4" />} {done ? "Abrindo venda…" : "Confirmar venda"}
          </Button>
          <p className="text-center text-[12px] text-fg-subtle">As parcelas entram automaticamente nas cobranças.</p>
        </aside>
      </div>
    );
  }

  /* -------- Celular: etapas -------- */
  const sections: Record<number, { title: string; description: string; body: React.ReactNode }> = {
    1: { title: "Cliente", description: "Quem comprou, onde e quando.", body: customerSection },
    2: { title: "Produtos", description: "Adicione os itens vendidos.", body: itemsSection },
    3: { title: "Pagamento", description: "À vista ou parcelado.", body: paymentSection },
    4: {
      title: "Revisão",
      description: "Confira tudo antes de confirmar.",
      body: (
        <div className="space-y-4">
          <SaleSummary draft={draft} computed={computed} products={products} cities={cities} />
          {errorBanner}
        </div>
      ),
    },
  };
  const current = sections[step];

  return (
    <div data-sale-form>
      <Stepper step={step} maxReached={maxReached} onGo={goTo} />
      <div className="overflow-x-clip">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.section key={step} custom={dir} variants={slide} initial="enter" animate="center" exit="exit" aria-labelledby={`step-${step}-title`}>
            <div className="mb-4">
              <h2 id={`step-${step}-title`} className="text-[18px] font-semibold tracking-tight text-fg">
                {current.title}
              </h2>
              <p className="text-[13px] text-fg-muted">{current.description}</p>
            </div>
            {current.body}
          </motion.section>
        </AnimatePresence>
      </div>

      {/* Barra de ações fixa */}
      <div className="pb-safe sticky bottom-0 z-20 -mx-4 mt-6 border-t border-line bg-bg/90 px-4 pt-3 backdrop-blur-md">
        <div className="mb-2 flex items-center justify-between text-[12px]">
          <span className="text-fg-muted">
            Etapa {step} de {STEPS.length}
          </span>
          <span className="text-fg-muted">
            Total <span className="money text-[14px] font-semibold text-fg">{formatBRL(Math.max(0, computed.totalCents) / 100)}</span>
          </span>
        </div>
        <div className="flex gap-2 pb-3">
          {step > 1 && (
            <Button variant="secondary" size="lg" onClick={() => goTo(step - 1)} disabled={busy} className="flex-1">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
          )}
          {step < 4 ? (
            <Button size="lg" onClick={next} className="flex-[2]">
              Continuar <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button size="lg" onClick={submit} loading={busy} disabled={busy} className="flex-[2]">
              {!busy && <Check className="h-4 w-4" />} {done ? "Abrindo venda…" : "Confirmar venda"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
