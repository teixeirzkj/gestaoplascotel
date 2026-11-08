"use client";

import { motion } from "framer-motion";
import { ease } from "@/lib/motion";

/** Transição entre páginas: entrada curta de baixo para cima (≤240ms), sem bloquear interação. */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: ease.out }}>
      {children}
    </motion.div>
  );
}
