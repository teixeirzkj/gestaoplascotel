import Link from "next/link";
import { History } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Table, Td, Th, Tr } from "@/components/ui/misc";
import { EmptyState } from "@/components/ui/states";
import { formatBRL, formatDate, formatDateLong, formatDateTime } from "@/lib/format";
import type { ClosingWithUser } from "../queries";
import { DivergenceValue } from "./divergence";

function dayHref(date: string, today: string) {
  return date === today ? "/caixa" : `/caixa?data=${date}`;
}

/** Histórico das últimas conferências (até 30). */
export function ClosingsHistory({ closings, today }: { closings: ClosingWithUser[]; today: string }) {
  return (
    <Card>
      <CardHeader icon={<History className="h-4 w-4" />} title="Conferências recentes" description="Últimos 30 fechamentos registrados" />
      {closings.length === 0 ? (
        <EmptyState
          compact
          title="Nenhuma conferência ainda"
          description="Ao fim do dia, use “Conferir caixa do dia” para registrar o fechamento e acompanhar divergências."
        />
      ) : (
        <>
          <ul className="mt-3 divide-y divide-line md:hidden">
            {closings.map((c) => (
              <li key={c.id}>
                <Link href={dayHref(c.closing_date, today)} className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 active:bg-white/[0.03]">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-fg">
                      {formatDate(c.closing_date)} <span className="font-normal text-fg-muted">· {formatDateLong(c.closing_date).split(",")[0]}</span>
                    </p>
                    <p className="mt-0.5 truncate text-[12px] text-fg-subtle">{c.closed_by_name ?? "Proprietário"}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="money text-sm font-semibold text-fg">{formatBRL(c.expected_total)}</p>
                    <DivergenceValue closing={c} className="text-[12px]" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-3 hidden md:block">
            <Table>
              <thead>
                <tr>
                  <Th>Dia</Th>
                  <Th className="text-right">Esperado</Th>
                  <Th className="text-right">Em dinheiro</Th>
                  <Th className="text-right">Contado</Th>
                  <Th>Divergência</Th>
                  <Th>Conferido por</Th>
                </tr>
              </thead>
              <tbody>
                {closings.map((c) => (
                  <Tr key={c.id}>
                    <Td>
                      <Link href={dayHref(c.closing_date, today)} className="font-medium text-fg hover:text-bronze">
                        {formatDate(c.closing_date)}
                      </Link>
                    </Td>
                    <Td className="money text-right">{formatBRL(c.expected_total)}</Td>
                    <Td className="money text-right text-fg-muted">{formatBRL(c.expected_cash)}</Td>
                    <Td className="money text-right">{c.counted_cash === null ? "—" : formatBRL(c.counted_cash)}</Td>
                    <Td>
                      <DivergenceValue closing={c} className="text-[13px]" />
                    </Td>
                    <Td className="text-fg-muted">
                      <span className="block">{c.closed_by_name ?? "Proprietário"}</span>
                      <span className="tabular text-[12px] text-fg-subtle">{formatDateTime(c.created_at)}</span>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
        </>
      )}
    </Card>
  );
}
