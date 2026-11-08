"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Bell, CalendarClock, CheckCheck, Clock, HandCoins, MapPin, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { getNotificationsAction, markNotificationsReadAction } from "@/features/shell/actions";
import type { NotificationItem } from "@/types/database";

const KIND_ICON: Record<string, typeof Bell> = {
  due_today: HandCoins,
  overdue: AlertTriangle,
  due_soon: Clock,
  broken_promise: ShieldAlert,
  visit_soon: MapPin,
  pending_confirmation: CheckCheck,
  needs_return: CalendarClock,
};
const SEVERITY: Record<string, string> = {
  danger: "bg-danger-soft text-danger-fg",
  warning: "bg-warning-soft text-warning",
  info: "bg-info-soft text-info",
};

/** Central de notificações internas (calculadas no banco a partir dos dados reais). Atualiza a cada 2 min. */
export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [error, setError] = useState(false);
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const r = await getNotificationsAction();
    if (r.ok) {
      setItems(r.data);
      setError(false);
    } else setError(true);
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const t = setInterval(load, 120_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [load, pathname]);

  // Fecha o painel ao trocar de rota (ajuste de estado durante o render, sem efeito).
  const [prevPath, setPrevPath] = useState(pathname);
  if (pathname !== prevPath) {
    setPrevPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const unread = (items ?? []).filter((n) => !n.is_read);

  const markRead = async (keys: string[]) => {
    if (!keys.length) return;
    setItems((prev) => prev?.map((n) => (keys.includes(n.key) ? { ...n, is_read: true } : n)) ?? prev);
    await markNotificationsReadAction(keys);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notificações${unread.length ? ` (${unread.length} não lidas)` : ""}`}
        aria-expanded={open}
        className="relative inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-line bg-bg-elevated text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
      >
        <Bell className="h-[18px] w-[18px]" />
        <AnimatePresence>
          {unread.length > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="tabular absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white ring-2 ring-bg"
            >
              {unread.length > 99 ? "99+" : unread.length}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 420, damping: 32 } }}
            exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
            style={{ transformOrigin: "top right", zIndex: "var(--z-overlay)" }}
            className="fixed inset-x-3 top-16 flex max-h-[75dvh] flex-col overflow-hidden rounded-2xl border border-line-strong bg-bg-elevated shadow-pop sm:absolute sm:inset-x-auto sm:right-0 sm:top-[calc(100%+8px)] sm:w-[400px]"
            role="dialog"
            aria-label="Notificações"
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-fg">Notificações</p>
                <p className="text-[12px] text-fg-muted">{unread.length ? `${unread.length} não lida(s)` : "Tudo em dia"}</p>
              </div>
              {unread.length > 0 && (
                <button
                  type="button"
                  onClick={() => markRead(unread.map((n) => n.key))}
                  className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-medium text-bronze hover:bg-bronze-soft"
                >
                  <CheckCheck className="h-4 w-4" /> Marcar todas
                </button>
              )}
            </div>
            <div className="overflow-y-auto">
              {items === null && !error && <p className="px-4 py-10 text-center text-sm text-fg-muted">Carregando…</p>}
              {error && (
                <div className="px-4 py-10 text-center text-sm text-fg-muted">
                  Não foi possível carregar.{" "}
                  <button type="button" onClick={load} className="cursor-pointer font-medium text-bronze underline-offset-2 hover:underline">
                    Tentar novamente
                  </button>
                </div>
              )}
              {items && items.length === 0 && <p className="px-4 py-10 text-center text-sm text-fg-muted">Nenhuma notificação no momento.</p>}
              <ul>
                {items?.map((n) => {
                  const Icon = KIND_ICON[n.kind] ?? Bell;
                  return (
                    <li key={n.key}>
                      <Link
                        href={n.link}
                        onClick={() => markRead([n.key])}
                        className={cn("flex gap-3 border-b border-line px-4 py-3 transition-colors last:border-0 hover:bg-white/[0.03]", n.is_read && "opacity-60")}
                      >
                        <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", SEVERITY[n.severity] ?? SEVERITY.info)}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-fg">{n.title}</span>
                          <span className="block truncate text-[12px] text-fg-muted">{n.body}</span>
                        </span>
                        {!n.is_read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-bronze" aria-label="Não lida" />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
