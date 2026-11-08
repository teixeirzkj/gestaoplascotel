# Arquitetura

## Visão geral

```
Navegador (celular/desktop)
   │  HTML via streaming + Server Actions (POST)
   ▼
Next.js 16 (App Router) ── src/proxy.ts: renova a sessão, redireciona para /login
   │  Server Components: leitura (views/RPCs)
   │  Server Actions:    validação Zod → RPC/insert → revalidatePath
   ▼
Supabase
   ├─ Postgres: schema, RLS, views, RPCs SECURITY DEFINER, gatilhos de auditoria
   ├─ Auth:     e-mail/senha; perfil em public.profiles (papel owner/employee)
   └─ Storage:  bucket privado "receipts" (URL assinada)
```

**O banco é a fonte da verdade financeira.** Saldos, status de parcela, status do cliente e totais vêm das views e das RPCs. O frontend só formata e exibe esses valores. Ele nunca recalcula um saldo definitivo.

## Estrutura de pastas

```
src/
  app/
    layout.tsx               # raiz: fonte, tema, Providers (MotionConfig, Toaster)
    manifest.ts              # PWA (instalar na tela inicial)
    login/                   # tela pública de login
    (app)/                   # área autenticada (shell com navegação)
      page.tsx               # painel (dashboard)
      clientes/ vendas/ cobrancas/ agenda/ cidades/ produtos/
      caixa/ relatorios/ historico/ configuracoes/
      loading.tsx error.tsx not-found.tsx
    api/export/[tipo]/       # exportação CSV (relatórios)
  features/<feature>/        # organização por domínio
    actions.ts               # Server Actions ("use server"): runAction + Zod + assertUser/assertOwner
    queries.ts               # leituras para Server Components
    schemas.ts               # schemas Zod compartilhados (cliente + servidor)
    components/              # componentes da feature
  components/
    ui/                      # design system (Button, Card, Modal, Tabs, StatusBadge, MotionList...)
    layout/                  # AppShell (useShellUser), navegação, busca global, notificações
  lib/                       # format, dates (America/Bahia), money, labels, actions, auth, motion, supabase/*
  types/
    supabase.ts              # gerado do banco (npm run db:types)
    database.ts              # aliases de domínio (InstallmentView, CustomerView, ...)
supabase/
  migrations/                # schema, lógica, segurança, storage (aplicadas por scripts/db.mjs)
  tests/financial_rules.sql  # suíte de regras financeiras e RLS (npm run db:test)
  seed/demo.sql              # dados de demonstração
scripts/
  db.mjs                     # migrate | sql | file (Management API)
  seed-demo.mjs              # carga demo + comprovante no Storage
  reset-demo.mjs             # limpa todos os dados de negócio
docs/                        # esta documentação
```

## Fluxo de dados

### Leitura

1. A página (Server Component) chama `createClient()` de `@/lib/supabase/server`, que usa a sessão do cookie.
2. Ela consulta as **views** (`v_installments`, `v_sales`, `v_customers`, `v_payments`, `v_promises`, `v_activity`, `v_cash_movements`) ou as **RPCs de leitura** (`dashboard_summary`, `monthly_series`, `report_summary`, `report_by_city`, `delinquency_aging`, `cash_day_summary`, `customers_to_visit`, `get_notifications`, `global_search`).
3. As views são `security_invoker`, então o RLS de quem consulta vale. Os dados chegam já calculados (saldo, `status`, `days_overdue`, `financial_status`).
4. Busca, filtros e paginação ficam na URL (`searchParams`, que são uma Promise no Next 16), então todo estado de lista pode ser compartilhado por link.

### Escrita

1. O Client Component (formulário com react-hook-form + Zod) chama uma Server Action.
2. A action usa `runAction(schema, input, fn)`, que revalida com Zod, roda `assertUser()`/`assertOwner()` e traduz os erros do banco (`friendlyDbError`). Ela retorna um `ActionResult`.
3. Operações financeiras chamam **somente RPCs**. O banco trava as linhas, valida e audita.
4. A action chama `revalidatePath(...)` nas rotas afetadas. O cliente mostra um toast (sonner) e chama `router.refresh()`.
5. Vendas e pagamentos enviam uma `idempotency_key`, gerada quando o modal abre. Um duplo clique ou um reenvio não duplica o lançamento.

## Vencimento, cobrança e visita: três datas diferentes

São três conceitos separados de propósito:

| Conceito | Onde fica | Muda? |
|---|---|---|
| **Vencimento financeiro** | `installments.original_due_date` | Não muda. É o que foi combinado na venda e a base do cálculo de atraso (`days_overdue`). |
| **Data de cobrança** | `installments.collection_date` | Muda a cada **adiamento** (`postpone_installment`, com motivo, histórico em `payment_postponements` e `postponed_count`). Define quando cobrar e o status `due_today`/`overdue`/`postponed`. |
| **Visita à cidade** | `visits.visit_date` (+ `visit_customers`) | É independente. É o dia em que alguém vai fisicamente à cidade. `customers_to_visit(city)` sugere quem incluir (em atraso, adiado, pediu visita, promessa quebrada). |

Exemplo: a parcela venceu dia 05 (vencimento). A cliente pediu para pagar dia 15, quando recebe o salário (cobrança, com `needs_visit`). A visita a Serrolândia está marcada para dia 14 (visita). Até o dia 15 a parcela fica como "adiada", fora da lista de atrasados, e entra como "Pagamento adiado · Pediu visita presencial" na sugestão da visita. Se o dia 15 passar sem pagamento, ela volta a ser "atrasada", e os dias de atraso são contados desde o vencimento original (dia 05), não desde a data adiada.

**Promessas** (`payment_promises`) registram um compromisso de valor e data. Elas são marcadas como cumpridas automaticamente quando os pagamentos confirmados desde a promessa cobrem o valor. A view `v_promises` expõe `effective_status = 'broken'` quando a data passa sem pagamento.

## Pagamentos e caixa

- `register_payment` cria o pagamento como `pending_confirmation`, ou já confirma (`p_confirm`). Um Pix com comprovante pode ficar pendente até alguém conferir o extrato.
- A confirmação atualiza `installments.paid_amount`, cria o movimento em `cash_movements`, registra a auditoria, cumpre promessas e quita a venda quando não resta saldo.
- O caixa do dia (`cash_day_summary`) é a soma dos movimentos: pagamentos, estornos (negativos) e ajustes, por forma de pagamento e por usuário. A conferência (`close_cash_day`) congela os valores esperados e a divergência em dinheiro.

## Interface

- Mobile-first: listas em cards no celular e tabelas a partir de `md:`. Alvos de toque de pelo menos 44px. Sem rolagem horizontal.
- O design system fica em `src/components/ui`, com tokens de cor em `src/app/globals.css` (tema escuro, marrom/bronze).
- Animações com framer-motion: tokens em `@/lib/motion`, `MotionConfig reducedMotion="user"` global, só `transform`/`opacity`.
- Toda rota tem `loading.tsx` (skeleton), estado vazio com ação e tratamento de erro (`error.tsx` do grupo).

## Como estender

### Controle de estoque

O schema já tem `products.track_stock`, `stock_quantity` e `sku`.

1. Crie a migração `stock_movements (id, product_id, kind in ('in','out','adjust'), quantity, sale_id, reason, created_by, created_at)`, sem política de escrita direta.
2. Na `create_sale`, para itens com `track_stock`, trave o produto (`FOR UPDATE`), valide o saldo, decremente e registre o movimento. Na `cancel_sale`, devolva o estoque.
3. Crie a RPC `stock_adjustment(product, qty, reason)`, só para o proprietário e com auditoria.
4. Na UI, mostre o saldo em Produtos, um alerta de estoque baixo em `get_notifications()` e o bloqueio na nova venda.

### WhatsApp

- Hoje: `ContactButtons` / `whatsappLink()` abrem o WhatsApp com a mensagem pronta (link `wa.me`), sem integração.
- Envio automático (lembretes de vencimento, recibos):
  1. Escolha um provedor oficial (WhatsApp Business Platform/Cloud API, ou um BSP como Twilio ou Z-API) e guarde o token só no servidor.
  2. Crie a tabela `message_outbox (customer_id, template, payload, status, sent_at, error)` e grave nela a partir das RPCs ou de um job.
  3. Processe a fila com um **cron** (Vercel Cron ou Supabase `pg_cron` + Edge Function), respeitando a janela de horário e o opt-out do cliente (`customers.whatsapp_opt_out`).
  4. Registre cada envio em `activity_logs` (ação `whatsapp_sent`).
- Use **templates aprovados** para mensagens fora da janela de 24h e nunca envie dados financeiros sensíveis sem necessidade.

### Mapas e rotas

O schema já tem `cities.latitude/longitude`, `customers.latitude/longitude` e `visits.route_order` / `visit_customers.stop_order`.

1. Capture as coordenadas no cadastro do cliente: botão "usar minha localização" (`navigator.geolocation`, já permitido em `Permissions-Policy`) ou geocodificação do endereço.
2. Na agenda, ordene as paradas por `stop_order` e abra a rota no Google Maps ou Waze com vários destinos (link `https://www.google.com/maps/dir/?api=1&waypoints=...`).
3. Para otimizar a rota, use uma API de *route optimization* no servidor e grave o resultado em `stop_order`.
4. Mapa de calor da inadimplência por cidade: `report_by_city` + coordenadas das cidades.

### Regras gerais para qualquer extensão

- Mudança no banco = **nova migração** (nunca edite migrações aplicadas), depois `npm run db:migrate` e `npm run db:types`.
- Escrita financeira = **RPC `SECURITY DEFINER`** com validação de papel, `FOR UPDATE`, validação de valores e `log_activity`.
- Acrescente casos na `supabase/tests/financial_rules.sql`.
- Crie a feature nova em `src/features/<nome>/` e a rota em `src/app/(app)/<rota>/` com `loading.tsx`.
