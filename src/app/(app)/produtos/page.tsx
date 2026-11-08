import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getProduct, listCategories, listProducts, type ProductStatusFilter } from "@/features/products/queries";
import { ProductsView } from "@/features/products/components/products-view";

export const metadata: Metadata = { title: "Produtos" };

const PAGE_SIZE = 30;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = one(sp.q)?.trim() || undefined;
  const category = one(sp.categoria) || undefined;
  const rawStatus = one(sp.situacao);
  const status: ProductStatusFilter = rawStatus === "inativos" ? "inativos" : rawStatus === "todos" ? "todos" : "ativos";
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const editId = one(sp.editar);

  const [{ rows, total }, categories, editing] = await Promise.all([
    listProducts({ q, category, status, page, pageSize: PAGE_SIZE }),
    listCategories(),
    editId && UUID_RE.test(editId) ? getProduct(editId) : Promise.resolve(null),
  ]);

  return (
    <ProductsView
      rows={rows}
      total={total}
      page={page}
      pageSize={PAGE_SIZE}
      categories={categories}
      editing={editing}
      editRequested={Boolean(editId)}
      isOwner={user.isOwner}
      hasFilters={Boolean(q || category || status !== "ativos")}
    />
  );
}
