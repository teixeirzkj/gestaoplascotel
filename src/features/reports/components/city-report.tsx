import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Table, Td, Th, Tr } from "@/components/ui/misc";
import { EmptyState } from "@/components/ui/states";
import { MotionItem, MotionList } from "@/components/ui/motion-list";
import { ButtonLink } from "@/components/ui/button";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import { cityRowKey, type CityRow } from "../shared";

function Metric({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-fg-muted">{label}</dt>
      <dd className={cn("money mt-0.5 truncate text-sm font-semibold text-fg", className)}>{formatBRL(value)}</dd>
    </div>
  );
}

export function CityReport({ rows }: { rows: CityRow[] }) {
  // A linha "Sem cidade" (city_id nulo) nunca é destaque.
  const top = rows.reduce<CityRow | null>(
    (best, r) => (r.city_id != null && r.total_pending > 0 && (!best || r.total_pending > best.total_pending) ? r : best),
    null,
  );

  return (
    <Card>
      <CardHeader
        icon={<MapPin className="h-4 w-4" />}
        title="Por cidade"
        description="Vendido e recebido no período · pendente e atraso na posição de hoje"
      />
      {rows.length === 0 ? (
        <EmptyState
          compact
          title="Nenhuma cidade cadastrada"
          description="Cadastre as cidades atendidas para acompanhar vendas e cobranças por região."
          action={
            <ButtonLink href="/cidades" variant="secondary" size="sm">
              Ver cidades
            </ButtonLink>
          }
        />
      ) : (
        <>
          <MotionList as="ul" className="mt-3 space-y-2.5 px-4 pb-4 md:hidden">
            {rows.map((r) => {
              const isTop = top != null && top.city_id === r.city_id;
              return (
                <MotionItem
                  as="li"
                  key={cityRowKey(r)}
                  className={cn("rounded-xl border p-3.5", isTop ? "border-warning/35 bg-warning-soft/40" : "border-line bg-bg-elevated")}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate text-[15px] font-semibold text-fg">
                      {r.city_name}
                      {r.state && <span className="ml-1 text-[13px] font-normal text-fg-muted">/{r.state}</span>}
                    </p>
                    {isTop && <Badge tone="warning">Mais pendências</Badge>}
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5">
                    <Metric label="Vendido" value={r.total_sold} />
                    <Metric label="Recebido" value={r.total_received} className="text-success" />
                    <Metric label="Pendente" value={r.total_pending} />
                    <Metric label="Atrasado" value={r.total_overdue} className={r.total_overdue > 0 ? "text-danger-fg" : undefined} />
                  </dl>
                  <p className="mt-3 border-t border-line pt-2.5 text-[12px] text-fg-muted">
                    <span className="tabular text-fg">{r.customers_count}</span> clientes ·{" "}
                    <span className={cn("tabular", r.overdue_customers > 0 ? "text-danger-fg" : "text-fg")}>{r.overdue_customers}</span> em atraso
                  </p>
                </MotionItem>
              );
            })}
          </MotionList>

          <div className="mt-3 hidden md:block">
            <Table>
              <thead>
                <tr>
                  <Th>Cidade</Th>
                  <Th className="text-right">Vendido</Th>
                  <Th className="text-right">Recebido</Th>
                  <Th className="text-right">Pendente</Th>
                  <Th className="text-right">Atrasado</Th>
                  <Th className="text-right">Clientes</Th>
                  <Th className="text-right">Em atraso</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const isTop = top != null && top.city_id === r.city_id;
                  return (
                    <Tr key={cityRowKey(r)} className={cn(isTop && "bg-warning-soft/30")}>
                      <Td>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {r.city_name}
                            {r.state && <span className="text-fg-muted">/{r.state}</span>}
                          </span>
                          {isTop && <Badge tone="warning">Mais pendências</Badge>}
                        </div>
                      </Td>
                      <Td className="money text-right">{formatBRL(r.total_sold)}</Td>
                      <Td className="money text-right text-success">{formatBRL(r.total_received)}</Td>
                      <Td className="money text-right font-semibold">{formatBRL(r.total_pending)}</Td>
                      <Td className={cn("money text-right", r.total_overdue > 0 ? "text-danger-fg" : "text-fg-muted")}>{formatBRL(r.total_overdue)}</Td>
                      <Td className="tabular text-right">{r.customers_count}</Td>
                      <Td className={cn("tabular text-right", r.overdue_customers > 0 ? "text-danger-fg" : "text-fg-muted")}>{r.overdue_customers}</Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        </>
      )}
    </Card>
  );
}
