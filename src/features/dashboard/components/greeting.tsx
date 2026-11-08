import { formatDateLong } from "@/lib/format";
import { TIME_ZONE, todayISO } from "@/lib/dates";

function partOfDay(now: Date) {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hour: "numeric", hourCycle: "h23" }).format(now));
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

/** Saudação curta com o primeiro nome e a data de hoje (America/Bahia). */
export function Greeting({ name }: { name: string }) {
  const first = name.trim().split(/\s+/)[0] || "";
  const date = formatDateLong(todayISO());
  return (
    <header className="mb-4 sm:mb-5">
      <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-bronze">{date}</p>
      <h1 className="mt-1 text-[22px] font-semibold leading-tight tracking-tight text-fg sm:text-[26px]">
        {partOfDay(new Date())}
        {first ? `, ${first}` : ""}
      </h1>
    </header>
  );
}
