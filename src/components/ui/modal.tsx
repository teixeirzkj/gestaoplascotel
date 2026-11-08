"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useDragControls } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ease } from "@/lib/motion";

/**
 * Modal responsivo: bottom sheet no celular (arrastável para baixo pela alça) e diálogo central no desktop.
 * ESC fecha, foco inicial no primeiro campo, scroll do fundo travado, scrim 55%.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  dismissible?: boolean;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const lastActive = useRef<Element | null>(null);
  const dragControls = useDragControls();
  // onClose costuma ser uma arrow inline: guardamos a versão atual num ref para o efeito abaixo
  // rodar só ao abrir/fechar (senão cada re-render roubaria o foco e refaria o autofocus).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    lastActive.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) onCloseRef.current();
      if (e.key === "Tab" && panelRef.current) {
        const f = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
        );
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const t = setTimeout(() => {
      // Não rouba o foco se a pessoa já tocou/digitou em algum campo do diálogo (o timer pode atrasar com a thread ocupada).
      const active = document.activeElement;
      if (active && active !== panelRef.current && panelRef.current?.contains(active)) return;
      const el = panelRef.current?.querySelector<HTMLElement>("[data-autofocus], input:not([type=hidden]):not([disabled]), select, textarea");
      (el ?? panelRef.current)?.focus({ preventScroll: true });
    }, 60);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
      clearTimeout(t);
      (lastActive.current as HTMLElement | null)?.focus?.({ preventScroll: true });
    };
  }, [open, dismissible]);

  if (typeof document === "undefined") return null;

  const widths = { sm: "sm:max-w-md", md: "sm:max-w-lg", lg: "sm:max-w-2xl" };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 flex items-end justify-center sm:items-center sm:p-6" style={{ zIndex: "var(--z-modal)" }}>
          <motion.div
            className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            onClick={() => dismissible && onClose()}
            aria-hidden
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className={cn(
              "relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-line-strong bg-bg-elevated shadow-pop outline-none",
              "sm:rounded-2xl",
              widths[size],
            )}
            initial={{ y: 40, opacity: 0, scale: 1 }}
            animate={{ y: 0, opacity: 1, transition: { type: "spring", stiffness: 380, damping: 34 } }}
            exit={{ y: 30, opacity: 0, transition: { duration: 0.16, ease: ease.in } }}
            drag={dismissible ? "y" : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            dragListener={false}
            dragControls={dragControls}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose();
            }}
          >
            {/* Alça do bottom sheet (mobile): área de arraste de 44px; puxar para baixo fecha */}
            <div
              className={cn("flex h-11 items-center justify-center touch-none sm:hidden", dismissible && "cursor-grab active:cursor-grabbing")}
              onPointerDown={(e) => {
                if (dismissible) dragControls.start(e);
              }}
              aria-hidden
            >
              <span className="h-1 w-10 rounded-full bg-white/20" />
            </div>
            <div className="flex items-start justify-between gap-3 border-b border-line px-5 pb-4 pt-0 sm:pt-5">
              <div className="min-w-0">
                <h2 id={titleId} className="text-[17px] font-semibold tracking-tight text-fg">
                  {title}
                </h2>
                {description && <div className="mt-1 text-[13px] text-fg-muted">{description}</div>}
              </div>
              {dismissible && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Fechar"
                  className="-mr-2 -mt-1 inline-flex h-11 w-11 shrink-0 sm:h-10 sm:w-10 cursor-pointer items-center justify-center rounded-xl text-fg-muted transition-colors hover:bg-white/5 hover:text-fg"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
            {footer && (
              <div className="pb-safe flex flex-col-reverse gap-2 border-t border-line bg-bg-elevated px-5 py-3.5 sm:flex-row sm:justify-end">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
