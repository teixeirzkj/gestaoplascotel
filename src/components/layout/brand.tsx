import { cn } from "@/lib/utils";

/** Identidade tipográfica provisória (até a logo oficial ser fornecida). */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[11px] bg-gradient-to-br from-[#a88762] to-[#6f5539]",
        className,
      )}
    >
      <span className="text-[15px] font-bold tracking-tight text-[#f1f0ed]">P</span>
      <span className="absolute bottom-1.5 right-1.5 h-1 w-1 rounded-full bg-[#f1f0ed]/80" />
    </span>
  );
}

export function BrandWordmark({ className, collapsed }: { className?: string; collapsed?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <BrandMark />
      {!collapsed && (
        <span className="flex flex-col leading-none">
          <span className="text-[15px] font-semibold tracking-[0.22em] text-fg">PLASCOTEL</span>
          <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-bronze">Gestão comercial</span>
        </span>
      )}
    </span>
  );
}
