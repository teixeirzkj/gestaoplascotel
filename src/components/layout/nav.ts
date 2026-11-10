import {
  LayoutDashboard, MessageCircle, Users, ShoppingBag, HandCoins, CalendarDays, MapPin, Package, Wallet, BarChart3, History, Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; ownerOnly?: boolean; group: "operacao" | "gestao" | "sistema" };

/** Navegação principal. ownerOnly também é verificado no servidor (requireOwnerPage) e no banco (RLS/RPC). */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, group: "operacao" },
  { href: "/cobrancas", label: "Cobranças", icon: HandCoins, group: "operacao" },
  { href: "/mensagens", label: "Mensagens", icon: MessageCircle, group: "operacao" },
  { href: "/clientes", label: "Clientes", icon: Users, group: "operacao" },
  { href: "/vendas", label: "Vendas", icon: ShoppingBag, group: "operacao" },
  { href: "/agenda", label: "Agenda", icon: CalendarDays, group: "operacao" },
  { href: "/cidades", label: "Cidades", icon: MapPin, group: "gestao" },
  { href: "/produtos", label: "Produtos", icon: Package, group: "gestao" },
  { href: "/caixa", label: "Caixa", icon: Wallet, group: "gestao", ownerOnly: true },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3, group: "gestao", ownerOnly: true },
  { href: "/historico", label: "Histórico", icon: History, group: "sistema" },
  { href: "/configuracoes", label: "Configurações", icon: Settings, group: "sistema", ownerOnly: true },
];

export const NAV_GROUPS: { key: NavItem["group"]; label: string }[] = [
  { key: "operacao", label: "Operação" },
  { key: "gestao", label: "Gestão" },
  { key: "sistema", label: "Sistema" },
];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}
