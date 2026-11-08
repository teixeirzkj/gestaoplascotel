import { AlertTriangle, CheckCircle2, ClipboardCheck } from "lucide-react";
import { Card, CardBody, CardHeader, DataRow } from "@/components/ui/card";
import { formatBRL, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ClosingWithUser } from "../queries";
import { ClosingButton, type Expected } from "./closing-dialog";
import { DivergenceValue } from "./divergence";

/** Conferência do dia: card da conferência feita ou chamada para conferir. */
export function ClosingCard({
  date,
  closing,
  expected,
  isOwner,
}: {
  date: string;
  closing: ClosingWithUser | null;
  expected: Expected;
  isOwner: boolean;
}) {
  if (!closing) {
    return (
      <Card className="border-dashed border-line-strong">
        <CardHeader
          icon={<ClipboardCheck className="h-4 w-4" />}
          title="Conferência pendente"
          description={isOwner ? "Confira o dinheiro em mãos e registre o fechamento do dia." : "O proprietário ainda não conferiu este dia."}
        />
        {isOwner && (
          <CardBody>
            <ClosingButton date={date} expected={expected} />
          </CardBody>
        )}
        {!isOwner && <div className="pb-4" />}
      </Card>
    );
  }

  const changedAfter = Math.round((expected.total - closing.expected_total) * 100) !== 0;
  const ok = closing.counted_cash === null || closing.divergence === 0;

  return (
    <Card className={cn(ok ? "border-success/25" : closing.divergence < 0 ? "border-danger/30" : "border-warning/30")}>
      <CardHeader
        icon={ok ? <CheckCircle2 className="h-4 w-4 text-success" /> : <AlertTriangle className="h-4 w-4 text-warning" />}
        title="Caixa conferido"
        description={`${closing.closed_by_name ?? "Proprietário"} · ${formatDateTime(closing.created_at)}`}
      />
      <CardBody className="pt-3">
        <div className="divide-y divide-line">
          <DataRow label="Esperado (total)" value={<span className="money">{formatBRL(closing.expected_total)}</span>} />
          <DataRow label="Esperado em dinheiro" value={<span className="money">{formatBRL(closing.expected_cash)}</span>} />
          <DataRow
            label="Dinheiro contado"
            value={<span className="money">{closing.counted_cash === null ? "—" : formatBRL(closing.counted_cash)}</span>}
          />
          <DataRow label="Divergência" value={<DivergenceValue closing={closing} />} />
        </div>
        {closing.notes && (
          <p className="mt-3 rounded-xl bg-bg-elevated px-3.5 py-2.5 text-[13px] leading-relaxed text-fg-muted">{closing.notes}</p>
        )}
        {changedAfter && (
          <p className="mt-3 flex items-start gap-2 rounded-xl border border-warning/25 bg-warning-soft px-3.5 py-2.5 text-[12.5px] leading-relaxed text-warning">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Houve movimentações depois da conferência: o total atual do dia ({formatBRL(expected.total)}) difere do conferido.
          </p>
        )}
      </CardBody>
    </Card>
  );
}
