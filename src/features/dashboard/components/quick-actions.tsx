import Link from "next/link";
import { CalendarClock, CalendarPlus, HandCoins, ShoppingBag, UserPlus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type QuickAction = { href: string; label: string; short: string; icon: LucideIcon; ownerOnly?: boolean; primary?: boolean };

const ACTIONS: QuickAction[] = [
  { href: "/cobrancas?aba=hoje", label: "Registrar pagamento", short: "Receber", icon: HandCoins, primary: true },
  { href: "/clientes/novo", label: "Cadastrar cliente", short: "Novo cliente", icon: UserPlus, ownerOnly: true },
  { href: "/vendas/nova", label: "Registrar venda", short: "Nova venda", icon: ShoppingBag, ownerOnly: true },
  { href: "/cobrancas?aba=atrasadas", label: "Adiar cobrança", short: "Adiar", icon: CalendarClock },
  { href: "/agenda?nova=1", label: "Agendar visita", short: "Visita", icon: CalendarPlus },
];

/** Atalhos das tarefas mais frequentes. Ações do proprietário ficam ocultas para funcionários. */
export function QuickActions({ isOwner }: { isOwner: boolean }) {
  const items = ACTIONS.filter((a) => !a.ownerOnly || isOwner);
  return (
    <nav aria-label="Ações rápidas" className="min-w-0">
      <h2 className="mb-2.5 text-[13px] font-semibold uppercase tracking-[0.08em] text-fg-muted">Ações rápidas</h2>
      <ul className={cn("grid gap-2", items.length === 5 ? "grid-cols-5" : "grid-cols-3")}>
        {items.map((a) => {
          const Icon = a.icon;
          return (
            <li key={a.href} className="min-w-0">
              <Link
                href={a.href}
                className={cn(
                  "group flex h-full min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-2xl border px-1 py-2.5 text-center transition-[background-color,border-color,transform] duration-150 active:scale-[0.97]",
                  a.primary
                    ? "border-bronze/30 bg-bronze-soft hover:border-bronze/50"
                    : "border-line bg-card hover:border-line-strong hover:bg-card-hover",
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
                    a.primary ? "bg-brand text-white" : "bg-white/[0.05] text-bronze group-hover:bg-bronze-soft",
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" aria-hidden />
                </span>
                <span className="text-[12px] font-medium leading-tight text-fg sm:hidden">{a.short}</span>
                <span className="hidden text-[12px] font-medium leading-tight text-fg sm:block">{a.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
