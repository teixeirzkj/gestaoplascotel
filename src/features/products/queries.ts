import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Product } from "@/types/database";

export type ProductRow = Pick<Product, "id" | "name" | "category" | "description" | "price" | "active" | "updated_at">;
export type ProductStatusFilter = "ativos" | "inativos" | "todos";

const COLUMNS = "id, name, category, description, price, active, updated_at";

/** Escapa curingas do ilike do PostgREST. */
export function likePattern(q: string) {
  return `%${q.replace(/[%_\]/g, (m) => `\${m}`).replace(/[,()]/g, " ")}%`;
}

export async function listProducts(opts: {
  q?: string;
  category?: string;
  status: ProductStatusFilter;
  page: number;
  pageSize: number;
}) {
  const supabase = await createClient();
  let query = supabase.from("products").select(COLUMNS, { count: "exact" });
  if (opts.q) query = query.ilike("name", likePattern(opts.q));
  if (opts.category === "__none") query = query.is("category", null);
  else if (opts.category) query = query.eq("category", opts.category);
  if (opts.status === "ativos") query = query.eq("active", true);
  if (opts.status === "inativos") query = query.eq("active", false);
  const from = (opts.page - 1) * opts.pageSize;
  const { data, error, count } = await query
    .order("active", { ascending: false })
    .order("name", { ascending: true })
    .range(from, from + opts.pageSize - 1);
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as ProductRow[], total: count ?? 0 };
}

export async function getProduct(id: string): Promise<ProductRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("products").select(COLUMNS).eq("id", id).maybeSingle();
  return (data as ProductRow | null) ?? null;
}

/** Categorias já usadas (para filtro e datalist). */
export async function listCategories(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("products").select("category").not("category", "is", null).limit(2000);
  if (error) throw new Error(error.message);
  const set = new Set<string>();
  for (const r of data ?? []) if (r.category) set.add(r.category.trim());
  return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export type ActiveProductOption = Pick<Product, "id" | "name" | "category" | "price">;

export async function listActiveProducts(): Promise<ActiveProductOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, name, category, price")
    .eq("active", true)
    .order("name")
    .limit(1000);
  if (error) throw new Error(error.message);
  return (data ?? []) as ActiveProductOption[];
}
