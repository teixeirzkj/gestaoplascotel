"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Trash2 } from "lucide-react";
import { Field, Input, MoneyInput, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/format";
import { ease, spring } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { ActiveProductOption } from "@/features/products/queries";
import { CUSTOM_ITEM, type Computed, type ItemDraft, type StepErrors } from "./draft";

export function ItemsEditor({
  items,
  products,
  computed,
  errors,
  onChangeItem,
  onAdd,
  onRemove,
}: {
  items: ItemDraft[];
  products: ActiveProductOption[];
  computed: Computed;
  errors: StepErrors;
  onChangeItem: (key: string, patch: Partial<ItemDraft>) => void;
  onAdd: () => void;
  onRemove: (key: string) => void;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, ActiveProductOption[]>();
    for (const p of products) {
      const k = p.category?.trim() || "Sem categoria";
      const arr = map.get(k) ?? [];
      arr.push(p);
      map.set(k, arr);
    }
    return [...map.entries()].sort(([a], [b]) => (a === "Sem categoria" ? 1 : b === "Sem categoria" ? -1 : a.localeCompare(b, "pt-BR")));
  }, [products]);
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  function pickSource(item: ItemDraft, source: string) {
    if (source === CUSTOM_ITEM || source === "") {
      onChangeItem(item.key, { source, description: item.source === CUSTOM_ITEM ? item.description : "" });
      return;
    }
    const p = byId.get(source);
    onChangeItem(item.key, { source, description: p?.name ?? "", unitPrice: p ? Number(p.price) : item.unitPrice });
  }

  return (
    <div className="space-y-3">
      <AnimatePresence initial={false} mode="popLayout">
        {items.map((item, idx) => {
          const line = computed.lines[idx] ?? 0;
          const err = (f: string) => errors[`item.${item.key}.${f}`];
          return (
            <motion.div
              key={item.key}
              layout
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1, transition: spring }}
              exit={{ opacity: 0, x: -16, transition: { duration: 0.16, ease: ease.in } }}
              className="rounded-2xl border border-line bg-bg-elevated p-3.5 sm:p-4"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">Item {idx + 1}</span>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onRemove(item.key)}
                    aria-label={`Remover item ${idx + 1}`}
                    className="-mr-1.5 -mt-1.5 inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-fg-muted transition-colors hover:bg-danger-soft hover:text-danger-fg"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="space-y-3">
                <Field label="Produto" required error={err("source")}>
                  <Select value={item.source} onChange={(e) => pickSource(item, e.target.value)}>
                    <option value="">Selecione…</option>
                    <option value={CUSTOM_ITEM}>Item avulso (digitar descrição)</option>
                    {groups.map(([cat, list]) => (
                      <optgroup key={cat} label={cat}>
                        {list.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} — {formatBRL(p.price)}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </Select>
                </Field>

                <AnimatePresence initial={false}>
                  {item.source === CUSTOM_ITEM && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
                    >
                      <Field label="Descrição do item" required error={err("description")}>
                        <Input
                          value={item.description}
                          maxLength={200}
                          onChange={(e) => onChangeItem(item.key, { description: e.target.value })}
                          placeholder="Ex.: Tapete 2x3 m"
                          autoComplete="off"
                        />
                      </Field>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-3 sm:grid-cols-3">
                  <Field label="Quantidade" required error={err("quantity")}>
                    <Input
                      inputMode="decimal"
                      value={item.quantity}
                      onChange={(e) => onChangeItem(item.key, { quantity: e.target.value.replace(/[^\d.,]/g, "") })}
                      className="tabular text-right"
                      autoComplete="off"
                    />
                  </Field>
                  <Field label="Valor unitário" required>
                    <MoneyInput value={item.unitPrice} onValueChange={(v) => onChangeItem(item.key, { unitPrice: v })} />
                  </Field>
                  <Field label="Desconto do item" error={err("discount")} className="col-span-2 sm:col-span-1">
                    <MoneyInput value={item.discount} onValueChange={(v) => onChangeItem(item.key, { discount: v })} />
                  </Field>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-sm">
                <span className="text-fg-muted">Subtotal do item</span>
                <span className={cn("money font-semibold", line < 0 ? "text-danger-fg" : "text-fg")}>{formatBRL(line / 100)}</span>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {errors.items && (
        <p role="alert" className="text-[12px] font-medium text-danger-fg">
          {errors.items}
        </p>
      )}

      <motion.div layout transition={spring}>
        <Button variant="outline" onClick={onAdd} className="w-full border-dashed" disabled={items.length >= 100}>
          <Plus className="h-4 w-4" /> Adicionar item
        </Button>
      </motion.div>
    </div>
  );
}
