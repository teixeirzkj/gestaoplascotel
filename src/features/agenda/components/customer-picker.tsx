"use client";

import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Search, UserPlus } from "lucide-react";
import { Checkbox, inputClasses } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { formatBRL } from "@/lib/format";
import { ease } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { getVisitCandidatesAction } from "../actions";
import type { VisitCandidates } from "../types";

type LoadState = { cityId: string; data: VisitCandidates | null; error: string | null };

/**
 * Seleção de clientes de uma cidade para a visita.
 * Sugestões vêm de customers_to_visit (com motivo); "outros clientes" são os demais clientes ativos da cidade.
 */
export function CustomerPicker({
  cityId,
  selected,
  onChange,
  excludeIds,
  preselect,
}: {
  cityId: string;
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  /** clientes já incluídos (não aparecem) */
  excludeIds?: Set<string>;
  /** pré-marcar clientes em atraso/que pediram visita ao carregar */
  preselect?: boolean;
}) {
  const [state, setState] = useState<LoadState | null>(null);
  const [reload, setReload] = useState(0);
  const [showOthers, setShowOthers] = useState(false);
  const [query, setQuery] = useState("");

  const onLoaded = useEffectEvent((data: VisitCandidates) => {
    if (!preselect) return;
    const next = new Set<string>();
    for (const s of data.suggested) if (s.preselect && !excludeIds?.has(s.customerId)) next.add(s.customerId);
    onChange(next);
  });

  useEffect(() => {
    let alive = true;
    getVisitCandidatesAction(cityId).then((r) => {
      if (!alive) return;
      if (r.ok) {
        setState({ cityId, data: r.data, error: null });
        onLoaded(r.data);
      } else {
        setState({ cityId, data: null, error: r.error });
      }
    });
    return () => {
      alive = false;
    };
  }, [cityId, reload]);

  const loading = !state || state.cityId !== cityId;
  const suggested = useMemo(
    () => (state?.data?.suggested ?? []).filter((s) => !excludeIds?.has(s.customerId)),
    [state, excludeIds],
  );
  const others = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("pt-BR");
    return (state?.data?.others ?? []).filter(
      (o) =>
        !excludeIds?.has(o.customerId) &&
        (!q || o.fullName.toLocaleLowerCase("pt-BR").includes(q) || (o.neighborhood ?? "").toLocaleLowerCase("pt-BR").includes(q)),
    );
  }, [state, excludeIds, query]);

  const toggle = (id: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    onChange(next);
  };

  if (loading) {
    return (
      <div className="space-y-2" role="status" aria-label="Carregando clientes">
        <Skeleton className="h-4 w-40" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    );
  }
  if (state.error) {
    return <ErrorState title="Não foi possível carregar os clientes" description={state.error} onRetry={() => setReload((n) => n + 1)} className="py-6" />;
  }

  const allSuggestedOn = suggested.length > 0 && suggested.every((s) => selected.has(s.customerId));
  const totalOthers = (state.data?.others ?? []).filter((o) => !excludeIds?.has(o.customerId)).length;

  return (
    <div className="space-y-4">
      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[13px] font-medium text-fg-muted">
            Sugeridos para visita <span className="tabular text-fg-subtle">({suggested.length})</span>
          </p>
          {suggested.length > 1 && (
            <button
              type="button"
              className="h-9 cursor-pointer rounded-lg px-2 text-[12.5px] font-medium text-bronze hover:bg-bronze-soft"
              onClick={() => {
                const next = new Set(selected);
                for (const s of suggested) {
                  if (allSuggestedOn) next.delete(s.customerId);
                  else next.add(s.customerId);
                }
                onChange(next);
              }}
            >
              {allSuggestedOn ? "Desmarcar todos" : "Marcar todos"}
            </button>
          )}
        </div>
        {suggested.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-4 py-3 text-[13px] text-fg-subtle">
            Nenhum cliente desta cidade com atraso, adiamento, pedido de visita ou cobrança nos próximos 7 dias.
          </p>
        ) : (
          <div className="grid gap-2">
            {suggested.map((s) => (
              <Checkbox
                key={s.customerId}
                checked={selected.has(s.customerId)}
                onChange={(on) => toggle(s.customerId, on)}
                label={
                  <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span>{s.fullName}</span>
                    <span className="money text-[12.5px] font-semibold text-fg">{formatBRL(s.balance)}</span>
                  </span>
                }
                description={
                  <>
                    {s.neighborhood && <span className="text-fg-subtle">{s.neighborhood} · </span>}
                    <span className={cn(s.overdueAmount > 0 ? "text-danger" : "text-bronze")}>{s.reason || "Cobrança próxima"}</span>
                  </>
                }
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <Button
          variant="ghost"
          className="w-full justify-between px-3"
          onClick={() => setShowOthers((v) => !v)}
          aria-expanded={showOthers}
          disabled={totalOthers === 0}
        >
          <span className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            {totalOthers === 0 ? "Nenhum outro cliente na cidade" : `Adicionar outros clientes da cidade (${totalOthers})`}
          </span>
          {totalOthers > 0 && <ChevronDown className={cn("h-4 w-4 transition-transform", showOthers && "rotate-180")} />}
        </Button>
        <AnimatePresence initial={false}>
          {showOthers && totalOthers > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.2, ease: ease.out } }}
              exit={{ opacity: 0, y: -4, transition: { duration: 0.13 } }}
              className="mt-2 space-y-2"
            >
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filtrar por nome ou bairro"
                  aria-label="Filtrar clientes por nome ou bairro"
                  className={inputClasses("pl-10")}
                />
              </div>
              {others.length === 0 ? (
                <p className="px-1 py-2 text-[13px] text-fg-subtle">Nenhum cliente corresponde ao filtro.</p>
              ) : (
                <div className="grid gap-2">
                  {others.map((o) => (
                    <Checkbox
                      key={o.customerId}
                      checked={selected.has(o.customerId)}
                      onChange={(on) => toggle(o.customerId, on)}
                      label={
                        <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                          <span>{o.fullName}</span>
                          <span className={cn("money text-[12.5px]", o.balance > 0 ? "font-semibold text-fg" : "text-fg-subtle")}>
                            {formatBRL(o.balance)}
                          </span>
                        </span>
                      }
                      description={o.neighborhood || "Bairro não informado"}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </div>
  );
}
