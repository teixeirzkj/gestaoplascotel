"use client";

import Link from "next/link";
import { History } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { Table, Td, Th, Tr } from "@/components/ui/misc";
import { MotionItem, MotionList } from "@/components/ui/motion-list";
import { FilterSelect, Pagination } from "@/components/ui/url-controls";
import { VISIT_STATUS } from "@/lib/labels";
import { formatDate } from "@/lib/format";
import { formatVisitTime, relativeDayLabel, weekdayShort } from "../utils";
import type { CityOption, VisitSummary } from "../types";
import { VisitCard } from "./visit-card";
import { VisitProgress } from "./visit-progress";

export function VisitHistory({
  items,
  total,
  page,
  pageSize,
  cities,
  today,
  filtered,
}: {
  items: VisitSummary[];
  total: number;
  page: number;
  pageSize: number;
  cities: CityOption[];
  today: string;
  filtered: boolean;
}) {
  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-2 md:flex md:justify-end">
        <FilterSelect
          param="local"
          label="Filtrar por cidade"
          placeholder="Todas as cidades"
          options={cities.map((c) => ({ value: c.id, label: `${c.name}/${c.state}` }))}
          className="md:w-56"
        />
        <FilterSelect
          param="situacao"
          label="Filtrar por situação"
          placeholder="Realizadas e canceladas"
          options={[
            { value: "done", label: "Realizadas" },
            { value: "cancelled", label: "Canceladas" },
          ]}
          className="md:w-56"
        />
      </div>

      {items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<History className="h-5 w-5" />}
            title={filtered ? "Nada encontrado com esses filtros" : "Nenhuma visita no histórico"}
            description={
              filtered
                ? "Altere a cidade ou a situação para ver outras visitas."
                : "Visitas marcadas como realizadas ou canceladas aparecem aqui, com o resultado de cada atendimento."
            }
          />
        </Card>
      ) : (
        <>
          <MotionList className="grid gap-2.5 md:hidden">
            {items.map((v) => (
              <MotionItem key={v.id}>
                <p className="tabular mb-1.5 text-[12px] font-medium text-fg-subtle">
                  <span className="capitalize">{weekdayShort(v.visitDate)}</span>, {formatDate(v.visitDate)} · {relativeDayLabel(v.visitDate, today)}
                </p>
                <VisitCard visit={v} />
              </MotionItem>
            ))}
          </MotionList>

          <Card className="hidden md:block">
            <Table>
              <thead>
                <tr>
                  <Th>Data da visita</Th>
                  <Th>Cidade</Th>
                  <Th>Situação</Th>
                  <Th className="w-[260px]">Atendimento</Th>
                  <Th>Observações</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((v) => (
                  <Tr key={v.id}>
                    <Td className="tabular whitespace-nowrap">
                      <Link href={`/agenda/${v.id}`} className="font-medium text-fg hover:text-bronze">
                        {formatDate(v.visitDate)}
                      </Link>
                      <span className="block text-[11.5px] text-fg-subtle">
                        <span className="capitalize">{weekdayShort(v.visitDate)}</span>
                        {v.visitTime && ` · ${formatVisitTime(v.visitTime)}`}
                      </span>
                    </Td>
                    <Td>
                      <Link href={`/agenda/${v.id}`} className="font-medium text-fg hover:text-bronze">
                        {v.cityName}
                      </Link>
                      <span className="ml-1 text-[12px] text-fg-subtle">{v.cityState}</span>
                    </Td>
                    <Td>
                      <StatusBadge status={v.status} map={VISIT_STATUS} />
                    </Td>
                    <Td>
                      {v.total > 0 ? <VisitProgress attended={v.attended} total={v.total} size="sm" /> : <span className="text-[12px] text-fg-subtle">Sem clientes</span>}
                    </Td>
                    <Td className="max-w-[260px]">
                      <span className="line-clamp-2 text-[12.5px] text-fg-muted">{v.notes || "—"}</span>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </Card>
          <Pagination page={page} pageSize={pageSize} total={total} />
        </>
      )}
    </div>
  );
}
