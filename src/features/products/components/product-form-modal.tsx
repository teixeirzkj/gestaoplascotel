"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Checkbox, Field, Input, MoneyInput, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { formatBRL, formatDateTime } from "@/lib/format";
import { num } from "@/lib/money";
import { saveProduct } from "../actions";
import type { ProductRow } from "../queries";

type Props = {
  open: boolean;
  onClose: () => void;
  product: ProductRow | null;
  categories: string[];
  readOnly?: boolean;
};

/** Cadastro/edição de produto (proprietário) ou ficha somente leitura (funcionário). */
export function ProductFormModal({ open, onClose, product, categories, readOnly }: Props) {
  const router = useRouter();
  const formId = useId();
  const listId = useId();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(product?.name ?? "");
  const [category, setCategory] = useState(product?.category ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [price, setPrice] = useState<number>(product ? num(product.price) : 0);
  const [active, setActive] = useState(product?.active ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (readOnly) {
    if (!product) return null;
    return (
      <Modal open={open} onClose={onClose} title={product.name} description={product.category ?? "Sem categoria"} size="sm">
        <div className="space-y-4">
          <div className="rounded-2xl bg-paper px-4 py-3.5 text-paper-ink">
            <p className="text-[12px] font-medium text-paper-muted">Preço de venda</p>
            <p className="money mt-1 text-[26px] font-semibold leading-none tracking-tight">{formatBRL(product.price)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={product.active ? "success" : "muted"}>{product.active ? "Ativo" : "Inativo"}</Badge>
            <span className="text-[12px] text-fg-subtle">Atualizado em {formatDateTime(product.updated_at)}</span>
          </div>
          {product.description ? (
            <p className="whitespace-pre-line text-sm leading-relaxed text-fg">{product.description}</p>
          ) : (
            <p className="text-sm text-fg-muted">Sem descrição.</p>
          )}
        </div>
      </Modal>
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!name.trim()) local.name = "Informe o nome do produto.";
    if (price < 0) local.price = "O preço não pode ser negativo.";
    setErrors(local);
    if (Object.keys(local).length) return;

    startTransition(async () => {
      const r = await saveProduct({
        id: product?.id ?? null,
        name,
        category: category || null,
        description: description || null,
        price,
        active,
      });
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        toast.error(r.error);
        return;
      }
      toast.success(r.message ?? "Produto salvo.");
      router.refresh();
      onClose();
    });
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!pending) onClose();
      }}
      title={product ? "Editar produto" : "Novo produto"}
      description={product ? product.name : "Cadastre um item do catálogo para usar nas vendas."}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} loading={pending}>
            {product ? "Salvar alterações" : "Cadastrar produto"}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Nome" required error={errors.name}>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Ex.: Jogo de panelas 5 peças" autoComplete="off" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Categoria" error={errors.category} hint={categories.length ? "Escolha uma existente ou digite uma nova." : undefined}>
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              list={listId}
              maxLength={60}
              placeholder="Ex.: Utilidades"
              autoComplete="off"
            />
          </Field>
          <Field label="Preço de venda" required error={errors.price}>
            <MoneyInput value={price} onValueChange={setPrice} />
          </Field>
        </div>
        <datalist id={listId}>
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <Field label="Descrição" error={errors.description}>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} placeholder="Detalhes, medidas, cores…" />
        </Field>
        <Checkbox
          label="Produto ativo"
          description={active ? "Aparece na seleção de produtos ao registrar vendas." : "Fica oculto na seleção de novas vendas; o histórico é mantido."}
          checked={active}
          onChange={setActive}
        />
      </form>
    </Modal>
  );
}
