import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Cartão de seção do dashboard: título, descrição opcional e link "ver todos". */
export function DashSection({
  title,
  description,
  icon,
  href,
  hrefLabel = "Ver todos",
  className,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  href?: string;
  hrefLabel?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("min-w-0 overflow-hidden", className)}>
      <CardHeader
        title={title}
        description={description}
        icon={icon}
        action={href ? <SeeAllLink href={href} label={hrefLabel} /> : undefined}
      />
      <div className="px-4 pb-4 pt-3 sm:px-5 sm:pb-5">{children}</div>
    </Card>
  );
}

export function SeeAllLink({ href, label = "Ver todos" }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      className="-mr-2 -mt-1 inline-flex h-9 shrink-0 items-center gap-0.5 whitespace-nowrap rounded-lg px-2 text-[13px] font-medium text-bronze transition-colors hover:bg-bronze-soft"
    >
      {label}
      <ChevronRight className="h-4 w-4" aria-hidden />
    </Link>
  );
}

/** Executa uma consulta sem derrubar a página: a seção mostra seu próprio erro. */
export async function safeLoad<T>(fn: () => Promise<T>): Promise<{ ok: true; data: T } | { ok: false }> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    console.error("[dashboard]", e);
    return { ok: false };
  }
}
