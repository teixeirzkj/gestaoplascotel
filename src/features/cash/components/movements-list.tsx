import Link from "next/link";
import { ReceiptText } from "lucide-react";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Table, Td, Th, Tr } from "@/components/ui/misc";
import { EmptyState } from "@/components/ui/states";
import { MotionItem, MotionList } from "@/components/ui/motion-list";
import { CASH_KIND, methodLabel } from "@/lib/labels";
import { formatBRL, formatDateTime, formatTime, tsToBahiaDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CashMovementView } from "@/types/database";

function when(m: CashMovementView, date: string) {
  return tsToBahiaDate(m.created_at) === date ? formatTime(m.created_at) : formatDateTime(m.created_at);
}

function Amount({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("money whitespace-nowrap font-semibold", value < 0 ? "text-danger-fg" : "text-fg", className)}>
      {value > 0 ? "+" : value < 0 ? "−" : ""}
      {formatBRL(Math.abs(value))}
    </span>
  );
}

function Customer({ m }: { m: CashMovementView }) {
  if (!m.customer_id || !m.customer_name) return <span className="text-fg-subtle">—</span>;
  return (
    <Link href={`/clientes/${m.customer_id}`} className="font-medium text-fg underline-offset-4 hover:text-bronze hover:underline">
      {m.customer_name}
    </Link>
  );
}

export function MovementsList({ movements, date, action }: { movements: CashMovementView[]; date: string; action?: React.ReactNode }) {
  return (
    <Card>
      <CardHeader
        title="Movimentações do dia"
        description={movements.length ? `${movements.length} lançamento${movements.length > 1 ? "s" : ""}` : "Recebimentos, estornos e ajustes"}
        action={action}
      />
      {movements.length === 0 ? (
        <EmptyState
          compact
          icon={<ReceiptText className="h-5 w-5" />}
          title="Nenhuma movimentação neste dia"
          description="Pagamentos confirmados, estornos e ajustes aparecem aqui automaticamente."
        />
      ) : (
        <>
          {/* Celular: cards */}
          <MotionList as="ul" className="mt-3 divide-y divide-line md:hidden">
            {movements.map((m) => (
              <MotionItem as="li" key={m.id} className="px-4 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={m.kind} map={CASH_KIND} />
                      <span className="tabular text-[12px] text-fg-subtle">{when(m, date)}</span>
                    </div>
                    <p className="mt-1.5 truncate text-sm">
                      <Customer m={m} />
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-[13px] text-fg-muted">{m.description}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <Amount value={m.amount} className="text-[15px]" />
                    <p className="mt-1 text-[12px] text-fg-muted">{methodLabel(m.method)}</p>
                  </div>
                </div>
                <p className="mt-1.5 text-[12px] text-fg-subtle">por {m.created_by_name ?? "Sistema"}</p>
              </MotionItem>
            ))}
          </MotionList>

          {/* Desktop: tabela */}
          <div className="mt-3 hidden md:block">
            <Table>
              <thead>
                <tr>
                  <Th className="w-20">Hora</Th>
                  <Th>Tipo</Th>
                  <Th>Forma</Th>
                  <Th>Cliente</Th>
                  <Th>Descrição</Th>
                  <Th>Usuário</Th>
                  <Th className="text-right">Valor</Th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <Tr key={m.id}>
                    <Td className="tabular whitespace-nowrap text-fg-muted">{when(m, date)}</Td>
                    <Td>
                      <StatusBadge status={m.kind} map={CASH_KIND} />
                    </Td>
                    <Td className="whitespace-nowrap">{methodLabel(m.method)}</Td>
                    <Td className="max-w-[180px] truncate">
                      <Customer m={m} />
                    </Td>
                    <Td className="max-w-[260px] truncate text-fg-muted" title={m.description}>
                      {m.description}
                    </Td>
                    <Td className="whitespace-nowrap text-fg-muted">{m.created_by_name ?? "Sistema"}</Td>
                    <Td className="text-right">
                      <Amount value={m.amount} />
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
