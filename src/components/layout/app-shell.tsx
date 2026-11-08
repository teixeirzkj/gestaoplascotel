"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronsLeft, LogOut, Menu, Search, X } from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { ROLE_LABEL } from "@/lib/labels";
import { spring, ease } from "@/lib/motion";
import { signOutAction } from "@/features/shell/actions";
import { NAV_GROUPS, NAV_ITEMS, isActive } from "./nav";
import { BrandWordmark, BrandMark } from "./brand";
import { CommandPalette } from "./command-palette";
import { NotificationCenter } from "./notification-center";

export type ShellUser = { id: string; name: string; email: string | null; role: "owner" | "employee"; isOwner: boolean };

const UserContext = createContext<ShellUser | null>(null);
/** Usuário atual no cliente (apenas para UI — permissões reais são validadas no servidor/banco). */
export function useShellUser() {
  const u = useContext(UserContext);
  if (!u) throw new Error("useShellUser fora do AppShell");
  return u;
}

export function AppShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  // Preferência de sidebar recolhida (conveniência local)
  useEffect(() => {
    try {
      // Lido após a hidratação para não divergir do HTML do servidor.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(localStorage.getItem("plascotel:sidebar") === "1");
    } catch {}
  }, []);
  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem("plascotel:sidebar", c ? "0" : "1");
      } catch {}
      return !c;
    });
  };

  // Fecha o menu mobile ao navegar
  const [prevPath, setPrevPath] = useState(pathname);
  if (pathname !== prevPath) {
    setPrevPath(pathname);
    setMobileOpen(false);
  }

  // Atalho de busca: Ctrl/Cmd + K ou "/"
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
  }, [mobileOpen]);

  // Menu mobile como diálogo modal: foco inicial no "Fechar", ESC fecha, Tab preso no drawer
  // e, ao fechar, o foco volta ao botão hambúrguer.
  useEffect(() => {
    if (!mobileOpen) return;
    const trigger = menuBtnRef.current;
    const drawer = drawerRef.current;
    const raf = requestAnimationFrame(() => drawerRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus({ preventScroll: true }));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setMobileOpen(false);
        return;
      }
      if (e.key === "Tab" && drawerRef.current) {
        const f = drawerRef.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (!drawerRef.current.contains(document.activeElement)) {
          e.preventDefault();
          (e.shiftKey ? last : first).focus();
        } else if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      // Só devolve o foco se ele ainda estiver no drawer (não rouba o foco de quem abriu a busca, por ex.).
      const active = document.activeElement;
      if (!active || active === document.body || drawer?.contains(active)) trigger?.focus({ preventScroll: true });
    };
  }, [mobileOpen]);

  const items = NAV_ITEMS.filter((i) => !i.ownerOnly || user.isOwner);
  const current = items.find((i) => isActive(pathname, i.href));

  return (
    <UserContext.Provider value={user}>
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-paper focus:px-3 focus:py-2 focus:text-paper-ink">
        Pular para o conteúdo
      </a>
      <div className="flex min-h-dvh">
        {/* Sidebar desktop */}
        <motion.aside
          animate={{ width: collapsed ? 76 : 256 }}
          transition={spring}
          className="sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-bg-elevated lg:flex"
          style={{ zIndex: "var(--z-sidebar)" }}
        >
          <div className={cn("flex h-16 items-center border-b border-line", collapsed ? "justify-center px-0" : "px-5")}>
            <Link href="/" aria-label="PLASCOTEL — início">
              <BrandWordmark collapsed={collapsed} />
            </Link>
          </div>
          <SidebarNav items={items} pathname={pathname} collapsed={collapsed} />
          <div className="border-t border-line p-3">
            <UserBlock user={user} collapsed={collapsed} />
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
              className={cn(
                "mt-2 flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg px-3 text-[13px] text-fg-subtle transition-colors hover:bg-white/5 hover:text-fg",
                collapsed && "justify-center px-0",
              )}
            >
              <motion.span animate={{ rotate: collapsed ? 180 : 0 }} transition={spring}>
                <ChevronsLeft className="h-4 w-4" />
              </motion.span>
              {!collapsed && "Recolher menu"}
            </button>
          </div>
        </motion.aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Topbar */}
          <header
            className="sticky top-0 flex h-14 items-center gap-2 border-b border-line bg-bg/85 px-3 backdrop-blur-md sm:h-16 sm:px-5"
            style={{ zIndex: "var(--z-header)" }}
          >
            <button
              ref={menuBtnRef}
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menu"
              aria-expanded={mobileOpen}
              className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-fg transition-colors hover:bg-white/5 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link href="/" className="flex items-center gap-2 lg:hidden" aria-label="PLASCOTEL — início">
              <BrandMark className="h-8 w-8" />
              <span className="hidden text-[13px] font-semibold tracking-[0.2em] xs:inline">PLASCOTEL</span>
            </Link>
            <span className="hidden text-sm font-medium text-fg-muted lg:inline">{current?.label}</span>

            <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-line bg-bg-elevated px-3 text-[13px] text-fg-muted transition-colors hover:border-line-strong hover:text-fg sm:w-64"
                aria-label="Buscar clientes, vendas, cidades"
              >
                <Search className="h-4 w-4" />
                <span className="hidden sm:inline">Buscar cliente, venda…</span>
                <kbd className="ml-auto hidden rounded-md border border-line px-1.5 py-0.5 text-[11px] text-fg-subtle sm:inline">Ctrl K</kbd>
              </button>
              <NotificationCenter />
            </div>
          </header>

          <main id="conteudo" className="relative mx-auto w-full min-w-0 overflow-x-clip max-w-[1400px] flex-1 px-4 pb-24 pt-5 sm:px-6 sm:pt-6 lg:px-8 lg:pb-12">
            {children}
          </main>
        </div>
      </div>

      {/* Menu mobile */}
      <AnimatePresence>
        {mobileOpen && (
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Menu principal"
            className="fixed inset-0 lg:hidden"
            style={{ zIndex: "var(--z-overlay)" }}
          >
            <motion.div
              className="absolute inset-0 bg-black/55"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              onClick={() => setMobileOpen(false)}
              aria-hidden
            />
            <motion.nav
              aria-label="Navegação"
              className="pb-safe absolute inset-y-0 left-0 flex w-[86%] max-w-[320px] flex-col border-r border-line bg-bg-elevated"
              initial={{ x: "-100%" }}
              animate={{ x: 0, transition: { type: "spring", stiffness: 400, damping: 38 } }}
              exit={{ x: "-100%", transition: { duration: 0.18, ease: ease.in } }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={{ left: 0.3, right: 0 }}
              onDragEnd={(_, info) => {
                if (info.offset.x < -80 || info.velocity.x < -500) setMobileOpen(false);
              }}
            >
              <div className="flex h-16 items-center justify-between border-b border-line px-4">
                <BrandWordmark />
                <button
                  type="button"
                  data-autofocus
                  onClick={() => setMobileOpen(false)}
                  aria-label="Fechar menu"
                  className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-fg-muted hover:bg-white/5 hover:text-fg"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <SidebarNav items={items} pathname={pathname} collapsed={false} mobile onNavigate={() => setMobileOpen(false)} />
              <div className="border-t border-line p-3">
                <UserBlock user={user} collapsed={false} />
              </div>
            </motion.nav>
          </div>
        )}
      </AnimatePresence>

      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} isOwner={user.isOwner} />
    </UserContext.Provider>
  );
}

function SidebarNav({
  items,
  pathname,
  collapsed,
  mobile,
  onNavigate,
}: {
  items: typeof NAV_ITEMS;
  pathname: string;
  collapsed: boolean;
  mobile?: boolean;
  /** Chamado ao tocar em qualquer item (inclusive o da página atual): fecha o menu mobile. */
  onNavigate?: () => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto px-3 py-4">
      {NAV_GROUPS.map((g) => {
        const groupItems = items.filter((i) => i.group === g.key);
        if (!groupItems.length) return null;
        return (
          <div key={g.key} className="mb-4 last:mb-0">
            {!collapsed && <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">{g.label}</p>}
            <motion.ul
              className="space-y-0.5"
              initial={mobile ? "hidden" : false}
              animate="show"
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.03, delayChildren: 0.05 } } }}
            >
              {groupItems.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <motion.li key={item.href} variants={{ hidden: { opacity: 0, x: -10 }, show: { opacity: 1, x: 0 } }}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      title={collapsed ? item.label : undefined}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
                        collapsed && "justify-center px-0",
                        active ? "text-fg" : "text-fg-muted hover:bg-white/[0.04] hover:text-fg",
                      )}
                    >
                      {active && (
                        <motion.span
                          layoutId={mobile ? "nav-active-m" : "nav-active"}
                          transition={spring}
                          className="absolute inset-0 rounded-xl border border-bronze/25 bg-bronze-soft"
                        />
                      )}
                      <Icon className={cn("relative h-[18px] w-[18px] shrink-0", active && "text-bronze")} />
                      {!collapsed && <span className="relative">{item.label}</span>}
                    </Link>
                  </motion.li>
                );
              })}
            </motion.ul>
          </div>
        );
      })}
    </div>
  );
}

function UserBlock({ user, collapsed }: { user: ShellUser; collapsed: boolean }) {
  return (
    <div className={cn("flex items-center gap-2 rounded-xl", collapsed && "flex-col")}>
      <Link
        href="/perfil"
        title="Meu perfil"
        aria-label={`Meu perfil — ${user.name}`}
        className={cn(
          "flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-white/[0.04]",
          collapsed && "justify-center px-0",
        )}
      >
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-[12px] font-semibold text-fg" aria-hidden>
          {initials(user.name)}
        </span>
        {!collapsed && (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium text-fg">{user.name}</span>
            <span className="block truncate text-[11px] text-bronze">{ROLE_LABEL[user.role]} · Meu perfil</span>
          </span>
        )}
      </Link>
      <form action={signOutAction}>
        <button
          type="submit"
          aria-label="Sair"
          title="Sair"
          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-fg-subtle transition-colors hover:bg-danger-soft hover:text-danger-fg"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
