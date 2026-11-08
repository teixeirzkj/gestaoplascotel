import Link from "next/link";
import { ChevronRight, ShoppingBag } from "lucide-react";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Money, Table, Td, Th, Tr } from "@/components/ui/misc";
import { MotionItem, MotionList } from "@/components/ui/motion-list";
import { EmptyState } from "@/components/ui/states";
import { SALE_STATUS } from "@/lib/labels";
import { formatDate } from "@/lib/format";
import { num } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { SaleView } from "@/types/database";

function Progress({ paid, total }: { paid: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Percentual pago">
      <div className="h-full rounded-full bg-bronze" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function PurchasesTab({ sales, customerId, canSell }: { sales: SaleView[]; customerId: string; canSell: boolean }) {
  if (sales.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<ShoppingBag className="h-5 w-5" />}
          title="Nenhuma compra registrada"
          description="As vendas deste cliente — abertas, quitadas e canceladas — aparecem aqui."
          action={
            canSell && (
              <ButtonLink href={`/vendas/nova?cliente=${customerId}`}>
                <ShoppingBag className="h-4 w-4" /> Registrar venda
              </ButtonLink>
            )
          }
        />
      </Card>
    );
  }

  return (
    <>
      <MotionList as="ul" className="space-y-2.5 md:hidden">
        {sales.map((s) => (
          <MotionItem as="li" key={s.id}>
            <Link
              href={`/vendas/${s.id}`}
              className={cn(
                "block rounded-2xl border border-line bg-card p-3.5 shadow-card transition-colors active:bg-card-hover",
                s.status === "cancelled" && "opacity-70",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-fg">Venda #{s.code}</p>
                  <p className="tabular mt-0.5 text-[12.5px] text-fg-muted">
                    {formatDate(s.sale_date)} · {s.installments_count > 0 ? `${s.installments_count}x` : "à vista"}
                  </p>
                </div>
                <StatusBadge status={s.status} map={SALE_STATUS} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-[12px]">
                <div>
                  <p className="text-fg-subtle">Total</p>
                  <Money value={s.total} className="text-[13.5px] font-medium text-fg" />
                </div>
                <div>
                  <p className="text-fg-subtle">Pago</p>
                  <Money value={s.paid_total} className="text-[13.5px] font-medium text-fg" />
                </div>
                <div className="text-right">
                  <p className="text-fg-subtle">Saldo</p>
                  <Money value={s.balance} className={cn("text-[13.5px] font-semibold", num(s.balance) > 0 ? "text-fg" : "text-fg-subtle")} />
                </div>
              </div>
              {s.status !== "cancelled" && (
                <div className="mt-3">
                  <Progress paid={num(s.paid_total)} total={num(s.total)} />
                </div>
              )}
            </Link>
          </MotionItem>
        ))}
      </MotionList>

      <div className="hidden overflow-hidden rounded-2xl border border-line bg-card shadow-card md:block">
        <Table>
          <thead>
            <tr>
              <Th>Venda</Th>
              <Th>Data</Th>
              <Th>Condição</Th>
              <Th className="text-right">Total</Th>
              <Th className="text-right">Pago</Th>
              <Th className="text-right">Saldo</Th>
              <Th>Status</Th>
              <Th className="w-[1%]">
                <span className="sr-only">Abrir</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <Tr key={s.id} className={cn(s.status === "cancelled" && "opacity-70")}>
                <Td className="font-medium">
                  <Link href={`/vendas/${s.id}`} className="hover:text-bronze">
                    #{s.code}
                  </Link>
                </Td>
                <Td className="tabular text-fg-muted">{formatDate(s.sale_date)}</Td>
                <Td className="text-fg-muted">{s.installments_count > 0 ? `${s.installments_count} parcelas` : "À vista"}</Td>
                <Td className="text-right">
                  <Money value={s.total} />
                </Td>
                <Td className="text-right text-fg-muted">
                  <Money value={s.paid_total} />
                </Td>
                <Td className={cn("text-right font-medium", num(s.balance) > 0 ? "text-fg" : "text-fg-subtle")}>
                  <Money value={s.balance} />
                </Td>
                <Td>
                  <StatusBadge status={s.status} map={SALE_STATUS} />
                </Td>
                <Td>
                  <Link
                    href={`/vendas/${s.id}`}
                    aria-label={`Abrir venda #${s.code}`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] text-fg-muted transition-colors hover:bg-white/5 hover:text-fg"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </div>
    </>
  );
}
