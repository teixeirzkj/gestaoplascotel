import type { Transition, Variants } from "framer-motion";

/**
 * Tokens de movimento (framer-motion-skills + UI/UX Pro Max §7):
 * micro 150–200ms, entradas ≤300ms, saídas ~65% da entrada, molas suaves, stagger 30–50ms.
 * <MotionConfig reducedMotion="user"> no layout raiz respeita prefers-reduced-motion.
 */
export const ease = {
  out: [0.22, 1, 0.36, 1] as const,
  in: [0.4, 0, 1, 1] as const,
};

export const spring: Transition = { type: "spring", stiffness: 420, damping: 34, mass: 0.8 };
export const springSoft: Transition = { type: "spring", stiffness: 260, damping: 30 };

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.24, ease: ease.out } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.15, ease: ease.in } },
};

export const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.13 } },
};

/** Container com entrada escalonada dos filhos (listas, grades de cards) */
export const stagger = (delayChildren = 0.02, staggerChildren = 0.04): Variants => ({
  hidden: {},
  show: { transition: { delayChildren, staggerChildren } },
});

export const listItem: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: ease.out } },
  exit: { opacity: 0, x: -8, transition: { duration: 0.14 } },
};

export const pop: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: spring },
  exit: { opacity: 0, scale: 0.98, transition: { duration: 0.14 } },
};

/** Feedback de toque em botões/cards (escala sutil 0.97) */
export const tap = { scale: 0.97 };
