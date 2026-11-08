"use client";

import { motion } from "framer-motion";
import { ease } from "@/lib/motion";
import { useHydrated } from "@/lib/use-hydrated";

/**
 * Transição entre páginas: entrada curta de baixo para cima (≤240ms), sem bloquear interação.
 * No primeiro carregamento (HTML do servidor) o conteúdo aparece imediatamente — sem esperar o JS.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  return (
    <motion.div initial={hydrated ? { opacity: 0, y: 6 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: ease.out }}>
      {children}
    </motion.div>
  );
}
