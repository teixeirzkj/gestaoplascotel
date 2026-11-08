"use client";

import { motion, AnimatePresence } from "framer-motion";
import { stagger, listItem, fadeUp } from "@/lib/motion";

/** Container com entrada escalonada. Filhos devem ser <MotionItem>. */
export function MotionList({
  children,
  className,
  as = "div",
  delay = 0.02,
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "ul";
  delay?: number;
}) {
  const Comp = as === "ul" ? motion.ul : motion.div;
  return (
    <Comp variants={stagger(delay, 0.04)} initial="hidden" animate="show" className={className}>
      {children}
    </Comp>
  );
}

export function MotionItem({ children, className, as = "div" }: { children: React.ReactNode; className?: string; as?: "div" | "li" }) {
  const Comp = as === "li" ? motion.li : motion.div;
  return (
    <Comp variants={listItem} layout="position" className={className}>
      {children}
    </Comp>
  );
}

/** Bloco que entra suavemente (seções da página) */
export function FadeIn({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ delay }} className={className}>
      {children}
    </motion.div>
  );
}

/** Troca de conteúdo com crossfade (abas, filtros) */
export function SwapContent({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={id} variants={fadeUp} initial="hidden" animate="show" exit="exit" className={className}>
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
