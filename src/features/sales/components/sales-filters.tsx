"use client";

import { Field, Input } from "@/components/ui/field";
import { FilterSelect, SearchInput, useUrlParams } from "@/components/ui/url-controls";
import { PERIOD_OPTIONS } from "@/lib/dates";
import type { CityOption } from "../queries";

export function SalesFilters({ cities, today }: { cities: CityOption[]; today: string }) {
  const { params, set } = useUrlParams();
  const period = params.get("periodo");

  return (
    <div className="mb-4 space-y-2">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_170px_190px_170px]">
        <SearchInput placeholder="Buscar por cliente ou #código" />
        <div className="grid grid-cols-2 gap-2 md:contents">
          <FilterSelect
            param="status"
            label="Situação da venda"
            placeholder="Todas as situações"
            options={[
              { value: "open", label: "Em aberto" },
              { value: "paid", label: "Quitadas" },
              { value: "cancelled", label: "Canceladas" },
            ]}
          />
          <FilterSelect param="cidade" label="Cidade" placeholder="Todas as cidades" options={cities.map((c) => ({ value: c.id, label: `${c.name}/${c.state}` }))} />
          <FilterSelect param="periodo" label="Período" placeholder="Todo o período" options={PERIOD_OPTIONS} className="col-span-2 md:col-span-1" />
        </div>
      </div>
      {period === "custom" && (
        <div className="grid grid-cols-2 gap-2 md:max-w-md">
          <Field label="De">
            <Input type="date" max={today} value={params.get("de") ?? ""} onChange={(e) => set({ de: e.target.value || null })} />
          </Field>
          <Field label="Até">
            <Input type="date" max={today} value={params.get("ate") ?? ""} onChange={(e) => set({ ate: e.target.value || null })} />
          </Field>
        </div>
      )}
    </div>
  );
}
