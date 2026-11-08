"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { Segmented } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { useUrlParams } from "@/components/ui/url-controls";
import { PERIOD_OPTIONS, type PeriodKey } from "@/lib/dates";
import { fadeUp } from "@/lib/motion";

/** Seletor de período (?periodo=, ?de=, ?ate=). */
export function PeriodFilter({ period, from, to, today }: { period: PeriodKey; from: string; to: string; today: string }) {
  const { set, pending } = useUrlParams();
  const [showCustom, setShowCustom] = useState(period === "custom");
  const [de, setDe] = useState(from);
  const [ate, setAte] = useState(to);
  const invalid = !de || !ate || de > ate;

  function choose(v: PeriodKey) {
    if (v === "custom") {
      setShowCustom(true);
      setDe(from);
      setAte(to);
      return;
    }
    setShowCustom(false);
    set({ periodo: v === "month" ? null : v, de: null, ate: null });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Segmented<PeriodKey> options={PERIOD_OPTIONS} value={showCustom ? "custom" : period} onChange={choose} className="min-w-0" />
        {pending && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-bronze" aria-label="Atualizando" />}
      </div>
      <AnimatePresence initial={false}>
        {showCustom && (
          <motion.form
            key="custom"
            variants={fadeUp}
            initial="hidden"
            animate="show"
            exit="exit"
            onSubmit={(e) => {
              e.preventDefault();
              if (!invalid) set({ periodo: "custom", de, ate });
            }}
            className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-3 xs:flex-row xs:items-end"
          >
            <label className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="text-[12px] font-medium text-fg-muted">De</span>
              <Input type="date" value={de} max={today} onChange={(e) => setDe(e.target.value)} aria-invalid={invalid || undefined} />
            </label>
            <label className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="text-[12px] font-medium text-fg-muted">Até</span>
              <Input type="date" value={ate} min={de || undefined} onChange={(e) => setAte(e.target.value)} aria-invalid={invalid || undefined} />
            </label>
            <Button type="submit" disabled={invalid} loading={pending} className="xs:w-auto">
              Aplicar
            </Button>
          </motion.form>
        )}
      </AnimatePresence>
      {showCustom && invalid && <p className="text-[12px] text-danger-fg">A data inicial deve ser anterior ou igual à final.</p>}
    </div>
  );
}
