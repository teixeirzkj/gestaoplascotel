"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Erro isolado de uma seção (o restante do dashboard continua funcionando). */
export function SectionError({ title, className, bare }: { title: string; className?: string; bare?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const body = (
    <div role="alert" className="flex items-center gap-3 p-4 sm:p-5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger-soft text-danger-fg">
        <AlertTriangle className="h-[18px] w-[18px]" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-fg">{title}</p>
        <p className="text-[12.5px] text-fg-muted">Não foi possível carregar agora. Verifique a conexão.</p>
      </div>
      <Button variant="secondary" size="sm" loading={pending} onClick={() => startTransition(() => router.refresh())}>
        {!pending && <RotateCw className="h-4 w-4" aria-hidden />}
        <span className="hidden xs:inline">Tentar de novo</span>
      </Button>
    </div>
  );
  if (bare) return <div className={className}>{body}</div>;
  return <Card className={cn("min-w-0", className)}>{body}</Card>;
}
