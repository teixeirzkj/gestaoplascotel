"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronRight, Package, Plus, SearchX } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { MotionItem, MotionList } from "@/components/ui/motion-list";
import { Money, Table, Td, Th, Tr } from "@/components/ui/misc";
import { FilterSelect, Pagination, SearchInput, useUrlParams } from "@/components/ui/url-controls";
import { cn } from "@/lib/utils";
import { ProductFormModal } from "./product-form-modal";
import type { ProductRow } from "../queries";

type Props = {
  rows: ProductRow[];
  total: number;
  page: number;
  pageSize: number;
  categories: string[];
  editing: ProductRow | null;
  editRequested: boolean;
  isOwner: boolean;
  hasFilters: boolean;
};

type ModalState = { open: boolean; product: ProductRow | null; seq: number };

export function ProductsView({ rows, total, page, pageSize, categories, editing, editRequested, isOwner, hasFilters }: Props) {
  const { params, set } = useUrlParams();
  const [modal, setModal] = useState<ModalState>(() => ({ open: Boolean(editing), product: editing, seq: 0 }));
  // Sincroniza ?editar=<id> quando a URL muda sem remontar a página (ex.: busca global)
  const [syncedEditId, setSyncedEditId] = useState<string | null>(editing?.id ?? null);
  if ((editing?.id ?? null) !== syncedEditId) {
    setSyncedEditId(editing?.id ?? null);
    if (editing) setModal((m) => ({ open: true, product: editing, seq: m.seq + 1 }));
  }

  useEffect(() => {
    if (editRequested && !editing) toast.error("Produto não encontrado. Ele pode ter sido removido.");
  }, [editRequested, editing]);

  function openNew() {
    setModal((m) => ({ open: true, product: null, seq: m.seq + 1 }));
  }
  function openProduct(p: ProductRow) {
    setModal((m) => ({ open: true, product: p, seq: m.seq + 1 }));
  }
  function close() {
    setModal((m) => ({ ...m, open: false }));
    if (params.get("editar")) set({ editar: null }, { resetPage: false });
  }

  const categoryOptions = [...categories.map((c) => ({ value: c, label: c })), { value: "__none", label: "Sem categoria" }];

  return (
    <>
      <PageHeader
        title="Produtos"
        description={isOwner ? "Catálogo usado nas vendas. Toque em um produto para editar." : "Catálogo de produtos e preços de venda."}
        actions={
          isOwner && (
            <Button onClick={openNew} className="w-full sm:w-auto">
              <Plus className="h-4 w-4" /> Novo produto
            </Button>
          )
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_200px_160px]">
        <SearchInput placeholder="Buscar produto pelo nome" />
        <div className="grid grid-cols-2 gap-2 sm:contents">
          <FilterSelect param="categoria" label="Categoria" placeholder="Todas as categorias" options={categoryOptions} />
          <FilterSelect
            param="situacao"
            label="Situação"
            placeholder="Ativos"
            options={[
              { value: "inativos", label: "Inativos" },
              { value: "todos", label: "Todos" },
            ]}
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <Card>
          {hasFilters ? (
            <EmptyState
              icon={<SearchX className="h-5 w-5" />}
              title="Nenhum produto encontrado"
              description="Ajuste a busca ou os filtros para ver outros produtos."
              action={
                <Link href="/produtos" className={buttonClasses("secondary", "sm")}>
                  Limpar filtros
                </Link>
              }
            />
          ) : (
            <EmptyState
              icon={<Package className="h-5 w-5" />}
              title="Nenhum produto cadastrado"
              description={
                isOwner
                  ? "Cadastre os itens que você vende para agilizar o registro das vendas com preço sugerido."
                  : "O proprietário ainda não cadastrou produtos."
              }
              action={
                isOwner && (
                  <Button size="sm" onClick={openNew}>
                    <Plus className="h-4 w-4" /> Cadastrar produto
                  </Button>
                )
              }
            />
          )}
        </Card>
      ) : (
        <>
          <p className="tabular mb-2 text-[12px] text-fg-subtle">
            {total} {total === 1 ? "produto" : "produtos"}
          </p>

          {/* Celular: cards */}
          <MotionList className="space-y-2 md:hidden">
            {rows.map((p) => (
              <MotionItem key={p.id}>
                <button
                  type="button"
                  onClick={() => openProduct(p)}
                  aria-label={`${isOwner ? "Editar" : "Ver"} ${p.name}`}
                  className={cn(
                    "flex min-h-[68px] w-full cursor-pointer items-center gap-3 rounded-2xl border border-line bg-card p-3.5 text-left shadow-card transition-transform active:scale-[0.98]",
                    !p.active && "opacity-70",
                  )}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-bronze-soft text-bronze" aria-hidden>
                    <Package className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium text-fg">{p.name}</span>
                    <span className="mt-0.5 flex min-w-0 items-center gap-2 text-[12px] text-fg-muted">
                      <span className="truncate">{p.category ?? "Sem categoria"}</span>
                      {!p.active && (
                        <Badge tone="muted" className="h-5 px-2 text-[11px]">
                          Inativo
                        </Badge>
                      )}
                    </span>
                  </span>
                  <Money value={p.price} className="text-[15px] font-semibold text-fg" />
                  <ChevronRight className="h-4 w-4 shrink-0 text-fg-subtle" aria-hidden />
                </button>
              </MotionItem>
            ))}
          </MotionList>

          {/* Desktop: tabela */}
          <Card className="hidden overflow-hidden md:block">
            <Table>
              <thead>
                <tr>
                  <Th>Produto</Th>
                  <Th>Categoria</Th>
                  <Th>Situação</Th>
                  <Th className="text-right">Preço de venda</Th>
                  <Th className="w-14">
                    <span className="sr-only">Ações</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <Tr key={p.id} className="cursor-pointer" onClick={() => openProduct(p)}>
                    <Td className="max-w-[380px]">
                      <span className="block truncate font-medium">{p.name}</span>
                      {p.description && <span className="block truncate text-[12px] text-fg-muted">{p.description}</span>}
                    </Td>
                    <Td className="text-fg-muted">{p.category ?? "—"}</Td>
                    <Td>
                      <Badge tone={p.active ? "success" : "muted"}>{p.active ? "Ativo" : "Inativo"}</Badge>
                    </Td>
                    <Td className="text-right">
                      <Money value={p.price} className="font-semibold" />
                    </Td>
                    <Td>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openProduct(p);
                        }}
                        aria-label={isOwner ? `Editar ${p.name}` : `Ver ${p.name}`}
                        className={buttonClasses("ghost", "icon-sm")}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </Card>

          <Pagination page={page} pageSize={pageSize} total={total} />
        </>
      )}

      <ProductFormModal
        key={modal.seq}
        open={modal.open}
        onClose={close}
        product={modal.product}
        categories={categories}
        readOnly={!isOwner}
      />
    </>
  );
}
