@AGENTS.md

# PLASCOTEL — convenções do projeto

Sistema de gestão comercial (clientes, vendas, parcelas, cobranças, visitas, caixa). Interface 100% em pt-BR. **Mobile-first é prioridade máxima.**

## Stack
Next.js 16 (App Router, Turbopack, `proxy.ts` no lugar de middleware, **sem** Cache Components), React 19, TypeScript strict, Tailwind v4 (tokens em `src/app/globals.css`), framer-motion, Supabase (Postgres + Auth + Storage), Zod 4, react-hook-form, lucide-react, recharts, sonner.

- Em Next 16, `params` e `searchParams` de páginas são **Promises**: `const { id } = await params`.
- Guias oficiais em `node_modules/next/dist/docs/`.

## Arquitetura
- `supabase/migrations/*.sql`: schema, RLS e funções. **O banco é a fonte da verdade financeira.** Saldos, status de parcela e status do cliente vêm das views (`v_installments`, `v_sales`, `v_customers`, `v_promises`, `v_payments`, `v_activity`, `v_cash_movements`) e das RPCs. Nunca recalcule saldo definitivo no frontend.
- Operações financeiras são feitas **somente por RPC** (`create_sale`, `register_payment`, `confirm_payment`, `reject_payment`, `reverse_payment`, `postpone_installment`, `create_promise`, `resolve_promise`, `cash_adjustment`, `close_cash_day`, `cancel_sale`, `set_visit_customer_status`). Elas validam papel, travam linhas e gravam auditoria. Não há escrita direta nessas tabelas.
- Leitura para relatórios: `dashboard_summary()`, `monthly_series(n)`, `report_summary(from,to)`, `report_by_city(from,to)`, `delinquency_aging()`, `cash_day_summary(date)`, `customers_to_visit(city_id)`, `get_notifications()`, `global_search(q)`.
- `src/types/supabase.ts` é gerado do banco; `src/types/database.ts` tem os aliases de domínio (`InstallmentView`, `CustomerView`, `SaleView` etc.). Use-os.
- Organização por feature: `src/features/<feature>/{actions.ts,queries.ts,schemas.ts,components/*}`; rotas em `src/app/(app)/<rota>/`.
- **Server Components** buscam dados com `createClient()` de `@/lib/supabase/server`. **Server Actions** (`"use server"`) validam com Zod usando `runAction(schema, input, fn)` de `@/lib/actions` e retornam `ActionResult`. Depois de mutar, chame `revalidatePath(...)` nas rotas afetadas.
- Erros do banco: `friendlyDbError` (já usado por `runAction`). As RPCs lançam mensagens em pt-BR (código P0001), que são exibidas como estão.
- Idempotência: toda criação de venda/pagamento envia `idempotency_key` (gere com `crypto.randomUUID()` quando o formulário/modal abre, não no submit).

## Permissões
- Papéis: `owner` (proprietário) e `employee` (funcionário). No servidor: `requireUser()`, `requireOwnerPage()` (páginas), `assertUser()`, `assertOwner()` (actions) de `@/lib/auth`. No cliente: `useShellUser()` de `@/components/layout/app-shell`, **apenas para esconder botões**; a segurança real é RLS + RPC.
- Somente proprietário: criar/editar clientes, cidades e produtos; criar/cancelar vendas; estornos; ajustes e fechamento de caixa; relatórios; configurações; usuários.
- Funcionário: consultar tudo, registrar/confirmar pagamentos, anexar comprovantes, adiar, registrar promessas, observações e visitas.

## UI (design system: UI/UX Pro Max + framer-motion-skills)
- Use os componentes de `src/components/ui/`: `Button`/`ButtonLink`, `Badge`/`StatusBadge` (+ mapas em `@/lib/labels`), `Card`/`CardHeader`/`CardBody`/`DataRow`, `Field`/`Input`/`Textarea`/`Select`/`MoneyInput`/`PhoneInput`/`Checkbox`, `Modal` (bottom sheet no celular), `ConfirmDialog`, `Tabs`/`Segmented`, `PageHeader`/`SectionTitle`, `StatCard`, `MotionList`/`MotionItem`/`FadeIn`/`SwapContent`, `Skeleton`/`PageSkeleton`/`ListSkeleton`/`EmptyState`/`ErrorState`, `SearchInput`/`FilterSelect`/`Pagination`/`useUrlParams`, `Avatar`, `Money`, `ContactButtons`, `Table`/`Th`/`Td`/`Tr`.
- Cores somente por tokens (`bg-card`, `bg-bg-elevated`, `bg-paper`, `text-fg`, `text-fg-muted`, `text-bronze`, `bg-brand`, `border-line`, `text-success`, `bg-danger-soft`…). Nada de hex solto em componentes.
- Mobile-first: lista em **cards** no celular e **tabela** a partir de `md:`. Sem rolagem horizontal da página; alvos de toque ≥44px; inputs com 16px no celular (já padrão). Os 4 KPIs do dashboard ficam em `grid-cols-2` no celular.
- Animações: tokens em `@/lib/motion` (150–300ms, mola). `MotionConfig reducedMotion="user"` já está no layout raiz. Animar apenas `transform`/`opacity`.
- Formatação: `formatBRL`, `formatDate`, `formatDateTime`, `formatPhone`, `whatsappLink` de `@/lib/format`; datas de negócio com `todayISO()` de `@/lib/dates` (fuso America/Bahia). Dinheiro em centavos para pré-visualizações (`@/lib/money`).
- Toda página tem: `loading.tsx` (skeleton), estado vazio, estado de erro (o `error.tsx` do grupo cobre exceções), feedback de sucesso/erro via `toast` (sonner).
- Nada de botão sem ação, link morto ou número fixo fingindo ser dado real.

## Banco / scripts
- `node scripts/db.mjs migrate`: aplica migrações pendentes no projeto Supabase (Management API, credenciais em `.env.local`).
- `node scripts/db.mjs sql "select ..."`: consulta rápida (roda como postgres; use só para leitura/diagnóstico).
- `node scripts/db.mjs file supabase/tests/financial_rules.sql`: suíte de regras financeiras/RLS (termina com `TESTES_OK` e desfaz tudo).
- Regenerar tipos: `npx supabase gen types typescript --project-id $SUPABASE_PROJECT_REF --schema public > src/types/supabase.ts` (com `SUPABASE_ACCESS_TOKEN`).
