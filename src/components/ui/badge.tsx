import { cn } from "@/lib/utils";

export type BadgeTone = "success" | "danger" | "warning" | "info" | "neutral" | "muted" | "brand";

const tones: Record<BadgeTone, string> = {
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger-fg",
  warning: "bg-warning-soft text-warning",
  info: "bg-info-soft text-info",
  neutral: "bg-white/[0.07] text-fg",
  muted: "bg-white/[0.04] text-fg-muted",
  brand: "bg-bronze-soft text-bronze",
};

const dots: Record<BadgeTone, string> = {
  success: "bg-success",
  danger: "bg-danger",
  warning: "bg-warning",
  info: "bg-info",
  neutral: "bg-fg-muted",
  muted: "bg-fg-subtle",
  brand: "bg-bronze",
};

/** Badge sempre com texto (cor nunca é o único indicador — a11y). */
export function Badge({
  tone = "neutral",
  dot = true,
  className,
  children,
}: {
  tone?: BadgeTone;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[12px] font-medium leading-none",
        tones[tone],
        className,
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dots[tone])} aria-hidden />}
      {children}
    </span>
  );
}

/** Badge a partir de um mapa de status (ver src/lib/labels.ts) */
export function StatusBadge({
  status,
  map,
  className,
}: {
  status: string | null | undefined;
  map: Record<string, { label: string; tone: BadgeTone }>;
  className?: string;
}) {
  const meta = (status && map[status]) || { label: status ?? "—", tone: "muted" as BadgeTone };
  return (
    <Badge tone={meta.tone} className={className}>
      {meta.label}
    </Badge>
  );
}
