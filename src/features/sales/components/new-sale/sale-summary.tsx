"use client";

import { CalendarDays, MapPin, User } from "lucide-react";
import { formatBRL, formatDate } from "@/lib/format";
import { methodLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { ActiveProductOption } from "@/features/products/queries";
import type { CityOption } from "../../queries";
import { CUSTOM_ITEM, type Computed, type Draft } from "./draft";

function Row({ label, value, strong, className }: { label: React.ReactNode; value: React.ReactNode; strong?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3 py-1.5 text-sm", className)}>
      <span className="text-fg-muted">{label}</span>
      <span className={cn("money text-right", strong ? "font-semibold text-fg" : "text-fg")}>{value}</span>
    </div>
  );
}

/** Resumo da venda: revisão (passo 4 no celular) e painel fixo no desktop. */
export function SaleSummary({
  draft,
  computed,
  products,
  cities,
  variant = "full",
}: {
  draft: Draft;
  computed: Computed;
  products: ActiveProductOption[];
  cities: CityOption[];
  variant?: "full" | "aside";
}) {
  const c = computed;
  const byId = new Map(products.map((p) => [p.id, p]));
  const city = cities.find((x) => x.id === draft.cityId);
  const filledItems = draft.items
    .map((it, i) => ({ it, i }))
    .filter(({ it }) => it.source);
  const avista = draft.mode === "avista";
  const rows = c.rows;
  const allEqual = rows.length > 0 && rows.every((r) => r.amountCents === rows[0].amountCents);

  return (
    <div className="space-y-4">
      {/* Total em destaque */}
      <div className="rounded-2xl bg-paper px-4 py-4 text-paper-ink">
        <p className="text-[12px] font-medium text-paper-muted">Total da venda</p>
        <p className="money mt-1 text-[28px] font-semibold leading-none tracking-tight">{formatBRL(Math.max(0, c.totalCents) / 100)}</p>
        <p className="mt-2 text-[12.5px] text-paper-muted">
          {avista
            ? draft.cashReceived
              ? `À vista · recebido agora (${methodLabel(draft.cashMethod)})`
              : "À vista · a receber"
            : rows.length > 0
              ? `${c.downCents > 0 ? `Entrada de ${formatBRL(c.downCents / 100)} + ` : ""}${rows.length}x ${allEqual ? `de ${formatBRL(rows[0].amountCents / 100)}` : "(valores variados)"}`
              : "Defina as parcelas"}
        </p>
      </div>

      {/* Cliente */}
      <div className="space-y-1.5 text-sm">
        <p className="flex items-center gap-2 text-fg">
          <User className="h-4 w-4 shrink-0 text-bronze" aria-hidden />
          <span className={cn("truncate", draft.customer ? "font-medium" : "text-fg-subtle")}>{draft.customer?.full_name ?? "Cliente não selecionado"}</span>
        </p>
        <p className="flex items-center gap-2 text-fg-muted">
          <MapPin className="h-4 w-4 shrink-0" aria-hidden />
          <span className="truncate">{city ? `${city.name}/${city.state}` : "Sem cidade"}</span>
        </p>
        <p className="flex items-center gap-2 text-fg-muted">
          <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
          <span className="tabular">{formatDate(draft.saleDate)}</span>
        </p>
      </div>

      {/* Itens */}
      <div className="border-t border-line pt-3">
        <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">Itens</p>
        {filledItems.length === 0 ? (
          <p className="py-1 text-sm text-fg-subtle">Nenhum item adicionado.</p>
        ) : (
          <ul className="space-y-1">
            {filledItems.map(({ it, i }) => {
              const name = it.source === CUSTOM_ITEM ? it.description || "Item avulso" : (byId.get(it.source)?.name ?? it.description);
              const qty = c.parsedItems[i].validQty ? c.parsedItems[i].qty : 0;
              return (
                <li key={it.key} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 text-fg">
                    <span className="tabular text-fg-muted">{qty.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}× </span>
                    <span className={variant === "aside" ? "line-clamp-1" : ""}>{name}</span>
                  </span>
                  <span className="money shrink-0 text-fg">{formatBRL((c.lines[i] ?? 0) / 100)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Valores */}
      <div className="border-t border-line pt-2">
        <Row label="Subtotal" value={formatBRL(c.subtotalCents / 100)} />
        {c.discountCents > 0 && <Row label="Desconto geral" value={`− ${formatBRL(c.discountCents / 100)}`} />}
        <Row label="Total" value={formatBRL(Math.max(0, c.totalCents) / 100)} strong />
        {!avista && c.downCents > 0 && (
          <Row label={draft.downReceived ? "Entrada (recebida agora)" : "Entrada (a receber)"} value={formatBRL(c.downCents / 100)} />
        )}
        {!avista && <Row label="A parcelar" value={formatBRL(c.baseCents / 100)} />}
        {draft.paymentMethod && <Row label="Forma de pagamento" value={methodLabel(draft.paymentMethod)} />}
      </div>

      {/* Parcelas */}
      {!avista && rows.length > 0 && (
        <div className="border-t border-line pt-3">
          <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">Parcelas</p>
          <ol className={cn("space-y-1", variant === "aside" && "max-h-56 overflow-y-auto pr-1")}>
            {rows.map((r, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="tabular text-fg-muted">
                  {i + 1}ª · {formatDate(r.dueDate)}
                </span>
                <span className="money text-fg">{formatBRL(r.amountCents / 100)}</span>
              </li>
            ))}
          </ol>
          {c.diffCents !== 0 && (
            <p className="mt-2 text-[12px] font-medium text-warning">
              Diferença de {formatBRL(Math.abs(c.diffCents) / 100)} entre a soma e o valor a parcelar.
            </p>
          )}
        </div>
      )}

      {variant === "full" && (draft.conditions.trim() || draft.notes.trim()) && (
        <div className="space-y-2 border-t border-line pt-3 text-sm">
          {draft.conditions.trim() && (
            <p>
              <span className="text-fg-muted">Condições: </span>
              <span className="text-fg">{draft.conditions.trim()}</span>
            </p>
          )}
          {draft.notes.trim() && (
            <p className="whitespace-pre-line">
              <span className="text-fg-muted">Observações: </span>
              <span className="text-fg">{draft.notes.trim()}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
