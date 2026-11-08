"use client";

import { useEffect, useId, useRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { spring } from "@/lib/motion";

export type TabItem = { value: string; label: React.ReactNode; count?: number; href?: string };

/** Faixa rolável no celular: fade nas bordas indicando overflow (o px-4 mantém as pontas fora do fade). */
const SCROLLER_CLS =
  "relative -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 max-sm:[mask-image:linear-gradient(to_right,transparent,#000_16px,#000_calc(100%-16px),transparent)]";

/**
 * Centraliza o item ativo (aria-current/aria-pressed) dentro da faixa rolável quando ela transborda.
 * Ajusta só o scrollLeft da faixa (scrollIntoView também rolaria a página e os ancestrais).
 */
function useScrollActiveIntoView(value: string) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  useEffect(() => {
    const sc = scrollerRef.current;
    const el = sc?.querySelector<HTMLElement>('[aria-current="page"],[aria-pressed="true"]');
    const smooth = !first.current;
    first.current = false;
    if (!sc || !el || sc.scrollWidth <= sc.clientWidth) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // offsetLeft é medido a partir da própria faixa (que é `relative`), já incluindo o padding px-4.
    sc.scrollTo({ left: el.offsetLeft - (sc.clientWidth - el.offsetWidth) / 2, behavior: smooth && !reduce ? "smooth" : "auto" });
  }, [value]);
  return scrollerRef;
}

/**
 * Abas com indicador animado (layoutId). Rolagem horizontal própria no celular (sem quebrar a página).
 * - Controladas: value + onChange
 * - Por URL: informe href em cada item (deep-linking)
 */
export function Tabs({
  items,
  value,
  onChange,
  className,
  size = "md",
}: {
  items: TabItem[];
  value: string;
  onChange?: (value: string) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  const layoutId = useId();
  const scrollerRef = useScrollActiveIntoView(value);
  const isNav = items.some((i) => i.href);
  const Strip = isNav ? "nav" : "div";
  return (
    <div ref={scrollerRef} className={cn(SCROLLER_CLS, className)}>
      <Strip
        {...(isNav ? { "aria-label": "Seções" } : { role: "group" })}
        className="inline-flex min-w-full gap-1 border-b border-line sm:min-w-0"
      >
        {items.map((item) => {
          const active = item.value === value;
          const inner = (
            <>
              <span className="relative z-10 flex items-center gap-1.5">
                {item.label}
                {typeof item.count === "number" && (
                  <span
                    className={cn(
                      "tabular rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none",
                      active ? "bg-bronze/20 text-bronze" : "bg-white/[0.06] text-fg-muted",
                    )}
                  >
                    {item.count}
                  </span>
                )}
              </span>
              {active && (
                <motion.span layoutId={layoutId} transition={spring} className="absolute inset-x-1 -bottom-px h-[2px] rounded-full bg-bronze" />
              )}
            </>
          );
          const cls = cn(
            "relative inline-flex shrink-0 cursor-pointer items-center whitespace-nowrap px-3 font-medium transition-colors",
            size === "sm" ? "h-10 text-[13px]" : "h-11 text-sm",
            active ? "text-fg" : "text-fg-muted hover:text-fg",
          );
          return item.href ? (
            <Link key={item.value} href={item.href} aria-current={active ? "page" : undefined} className={cls} scroll={false}>
              {inner}
            </Link>
          ) : (
            <button key={item.value} type="button" aria-pressed={active} className={cls} onClick={() => onChange?.(item.value)}>
              {inner}
            </button>
          );
        })}
      </Strip>
    </div>
  );
}

/** Seletor segmentado compacto (filtros de período, visões) */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  const layoutId = useId();
  const scrollerRef = useScrollActiveIntoView(value);
  return (
    <div ref={scrollerRef} className={cn(SCROLLER_CLS, className)}>
      <div role="group" className="inline-flex gap-1 rounded-xl border border-line bg-bg-elevated p-1">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(o.value)}
              className={cn(
                "relative h-11 shrink-0 cursor-pointer sm:h-9 whitespace-nowrap rounded-[9px] px-3 text-[13px] font-medium transition-colors",
                active ? "text-fg" : "text-fg-muted hover:text-fg",
              )}
            >
              {active && <motion.span layoutId={layoutId} transition={spring} className="absolute inset-0 rounded-[9px] bg-card shadow-card" />}
              <span className="relative z-10">{o.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
