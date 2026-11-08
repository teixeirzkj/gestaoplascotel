-- =============================================================================
-- PLASCOTEL — Agregações no banco (substituem somas paginadas no frontend)
--   1. v_payments ganha city_id (cidade ATUAL do cliente) como última coluna
--   2. Índices para filtros/ordenações frequentes + busca por trigramas (pg_trgm)
--   3. sales_totals            — cards da lista de vendas
--   4. customers_open_balance  — saldo em aberto da lista de clientes
--   5. city_totals             — totais por cidade (arquivadas / detalhe da cidade)
--   6. collections_overview    — contagem e soma de cada aba da central de cobranças
-- Todas: security invoker (RLS do usuário logado), uma passada por fonte, sem
-- subconsulta correlacionada por linha (agregados condicionais com FILTER).
-- Os filtros replicam EXATAMENTE os usados hoje pelas queries do PostgREST
-- (inclusive as sanitizações de texto), para que totais e listas batam.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. v_payments + city_id (create or replace exige manter as colunas existentes
--    na mesma ordem; a nova vai no fim). Grants e security_invoker são mantidos.
-- -----------------------------------------------------------------------------
create or replace view public.v_payments with (security_invoker = true) as
select p.id, p.installment_id, p.sale_id, p.customer_id, p.amount, p.paid_on, p.method, p.notes, p.status,
  p.idempotency_key, p.created_by, p.created_at, p.confirmed_by, p.confirmed_at, p.rejected_by, p.rejected_at,
  p.reversed_by, p.reversed_at, p.status_reason,
  c.full_name as customer_name, ci.name as city_name, s.code as sale_code, i.number as installment_number,
  pr.full_name as created_by_name, pc.full_name as confirmed_by_name,
  (select count(*) from public.payment_receipts r where r.payment_id = p.id) as receipts_count,
  c.city_id
from public.payments p
join public.customers c on c.id = p.customer_id
left join public.cities ci on ci.id = c.city_id
join public.sales s on s.id = p.sale_id
join public.installments i on i.id = p.installment_id
left join public.profiles pr on pr.id = p.created_by
left join public.profiles pc on pc.id = p.confirmed_by;

-- -----------------------------------------------------------------------------
-- 2. Índices
-- installments(sale_id) NÃO é criado: já coberto pelo único (sale_id, number).
-- -----------------------------------------------------------------------------
create index if not exists payments_pending_created_idx on public.payments (created_at) where status = 'pending_confirmation';
create index if not exists payments_status_paid_on_idx on public.payments (status, paid_on);
create index if not exists sales_status_date_idx on public.sales (status, sale_date);
create index if not exists visit_customers_customer_idx on public.visit_customers (customer_id);
-- O composto substitui o simples (mesmo prefixo) e atende a timeline de observações.
create index if not exists customer_notes_customer_created_idx on public.customer_notes (customer_id, created_at desc);
drop index if exists public.customer_notes_customer_idx;

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;
-- Trigramas na coluna (não em lower()): gin_trgm_ops já é insensível a maiúsculas e é o
-- único formato que atende o ILIKE usado pelo PostgREST e pelas RPCs abaixo.
create index if not exists customers_full_name_trgm_idx on public.customers using gin (full_name extensions.gin_trgm_ops);
create index if not exists activity_logs_summary_trgm_idx on public.activity_logs using gin (summary extensions.gin_trgm_ops);

-- -----------------------------------------------------------------------------
-- 3. sales_totals — mesmos filtros de src/features/sales/queries.ts (applyFilters),
--    sempre sem canceladas (como sumSaleTotals). Busca: "#123"/"123" (1–12 dígitos)
--    => código exato; senão nome do cliente (ILIKE, curingas % _ \ escapados, , ( )
--    viram espaço e * vale % como no PostgREST). city = cidade da VENDA (v_sales.city_id).
-- -----------------------------------------------------------------------------
create or replace function public.sales_totals(
  p_q text default null, p_status text default null, p_city uuid default null, p_from date default null, p_to date default null)
returns jsonb
language sql stable security invoker set search_path = public as $$
  with f as (
    select t as term, regexp_replace(t, '^#', '') as code
    from (select regexp_replace(coalesce(p_q, ''), '^\s+|\s+$', '', 'g') as t) x
  ),
  per_sale as (
    select s.id, s.total, coalesce(sum(i.paid_amount), 0) as paid
    from public.sales s
    join public.customers c on c.id = s.customer_id
    left join public.installments i on i.sale_id = s.id
    cross join f
    where s.status <> 'cancelled'
      and (
        f.term = ''
        or (f.code ~ '^[0-9]{1,12}$' and s.code = f.code::bigint)
        or (f.code !~ '^[0-9]{1,12}$' and c.full_name ilike
              '%' || replace(regexp_replace(regexp_replace(f.term, '([%_\\])', '\\\1', 'g'), '[,()]', ' ', 'g'), '*', '%') || '%')
      )
      and (p_status is null or s.status::text = p_status)
      and (p_city is null or s.city_id = p_city)
      and (p_from is null or s.sale_date >= p_from)
      and (p_to is null or s.sale_date <= p_to)
    group by s.id
  )
  select jsonb_build_object(
    'count', count(*),
    'total', coalesce(sum(total), 0),
    'paid', coalesce(sum(paid), 0),
    'balance', coalesce(sum(total - paid), 0))
  from per_sale
$$;

-- -----------------------------------------------------------------------------
-- 4. customers_open_balance — mesmos filtros de src/features/customers/queries.ts
--    (applyFilters): termo sem , ( ) * % \ " ' : ; com letras (ou sem dígitos) => nome
--    ILIKE; 2+ dígitos => phone/whatsapp ILIKE; cidade; financial_status (mesma regra
--    de v_customers); p_archived = false => só ativos.
--    Retorno: count = clientes do filtro com saldo > 0; balance = soma desses saldos.
-- -----------------------------------------------------------------------------
create or replace function public.customers_open_balance(
  p_q text default null, p_city uuid default null, p_status text default null, p_archived boolean default false)
returns jsonb
language sql stable security invoker set search_path = public as $$
  with f as (
    select term, regexp_replace(term, '[^0-9]', '', 'g') as digits, term ~ '[[:alpha:]]' as has_letters, public.app_today() as t
    from (select btrim(regexp_replace(regexp_replace(coalesce(p_q, ''), '[,()*%\\"'':]', ' ', 'g'), '\s+', ' ', 'g')) as term) x
  ),
  inst as (
    select x.customer_id,
      sum(x.amount - x.paid_amount) as balance,
      count(*) filter (where x.paid_amount < x.amount and x.collection_date < f.t) as overdue_count,
      count(*) filter (where x.paid_amount < x.amount and x.collection_date = f.t) as due_today_count,
      count(*) filter (where x.paid_amount < x.amount and x.collection_date > x.original_due_date and x.collection_date > f.t) as postponed_count
    from public.installments x
    join public.sales sx on sx.id = x.sale_id
    cross join f
    where not x.cancelled and sx.status <> 'cancelled'
    group by x.customer_id
  ),
  sc as (
    select customer_id, count(*) as n from public.sales where status <> 'cancelled' group by customer_id
  ),
  pend as (
    select distinct customer_id from public.payments where status = 'pending_confirmation'
  ),
  broken as (
    select distinct pp.customer_id from public.payment_promises pp cross join f
    where pp.status = 'pending' and pp.due_date < f.t
  ),
  rows_ as (
    select coalesce(i.balance, 0) as balance,
      case
        when coalesce(sc.n, 0) = 0 then 'no_sales'
        when coalesce(i.overdue_count, 0) > 0 then 'overdue'
        when coalesce(i.postponed_count, 0) > 0 then 'postponed'
        when coalesce(i.balance, 0) = 0 then 'paid_off'
        when pend.customer_id is not null or broken.customer_id is not null or coalesce(i.due_today_count, 0) > 0 then 'pending'
        else 'up_to_date'
      end as financial_status
    from public.customers c
    cross join f
    left join inst i on i.customer_id = c.id
    left join sc on sc.customer_id = c.id
    left join pend on pend.customer_id = c.id
    left join broken on broken.customer_id = c.id
    where (
        f.term = ''
        or ((f.has_letters or f.digits = '') and c.full_name ilike '%' || f.term || '%')
        or (length(f.digits) >= 2 and (c.phone ilike '%' || f.digits || '%' or c.whatsapp ilike '%' || f.digits || '%'))
      )
      and (p_city is null or c.city_id = p_city)
      and (coalesce(p_archived, false) or c.archived_at is null)
  )
  select jsonb_build_object(
    'count', count(*) filter (where balance > 0),
    'balance', coalesce(sum(balance) filter (where balance > 0), 0))
  from rows_
  where p_status is null or financial_status = p_status
$$;

-- -----------------------------------------------------------------------------
-- 5. city_totals — mesma semântica de aggregateByCity (src/features/cities/queries.ts):
--    cidade ATUAL do cliente; pendente = restante das parcelas em aberto (parcela e
--    venda não canceladas, inclusive de clientes arquivados); atraso = collection_date
--    < hoje; customers_count = clientes não arquivados. Uma linha por id recebido
--    (zeros quando não há dados).
-- -----------------------------------------------------------------------------
create or replace function public.city_totals(p_city_ids uuid[])
returns table (city_id uuid, customers_count bigint, pending numeric, overdue numeric, overdue_customers bigint)
language sql stable security invoker set search_path = public as $$
  select u.id,
    count(distinct c.id) filter (where c.archived_at is null),
    coalesce(sum(o.remaining), 0)::numeric,
    coalesce(sum(o.remaining) filter (where o.collection_date < d.t), 0)::numeric,
    count(distinct o.customer_id) filter (where o.collection_date < d.t)
  from (select distinct unnest(p_city_ids) as id) u
  cross join (select public.app_today() as t) d
  left join public.customers c on c.city_id = u.id
  left join (
    select i.customer_id, i.amount - i.paid_amount as remaining, i.collection_date
    from public.installments i
    join public.sales s on s.id = i.sale_id
    where i.paid_amount < i.amount and not i.cancelled and s.status <> 'cancelled'
  ) o on o.customer_id = c.id
  where u.id is not null
  group by u.id
$$;

-- -----------------------------------------------------------------------------
-- 6. collections_overview — predicados de src/features/collections/queries.ts/tabs.ts.
--    Busca: sem , ( ) " \ * % : , espaços colapsados, até 60 caracteres; nome ILIKE;
--    nas parcelas também telefone/whatsapp com 4+ dígitos em sequência (%d%d%...%).
--    Cidade = cidade atual do cliente. Soma: restante; "pagas" = valor da parcela;
--    "confirmar" = valor dos pagamentos aguardando confirmação.
--    Retorno: {"<aba>": {"count": n, "sum": v}, ...}
-- -----------------------------------------------------------------------------
create or replace function public.collections_overview(p_q text default null, p_city uuid default null)
returns jsonb
language sql stable security invoker set search_path = public as $$
  with f as (
    select s, public.app_today() as t,
      case when length(d) >= 4 then '%' || array_to_string(regexp_split_to_array(d, ''), '%') || '%' end as phone_pat
    from (
      select s, regexp_replace(s, '[^0-9]', '', 'g') as d
      from (select left(btrim(regexp_replace(regexp_replace(coalesce(p_q, ''), '[,()"\\*%:]', ' ', 'g'), '\s+', ' ', 'g')), 60) as s) x
    ) y
  ),
  inst as (
    select
      count(*) filter (where o) as todas_n,         coalesce(sum(r) filter (where o), 0) as todas_s,
      count(*) filter (where o and cd = t) as hoje_n, coalesce(sum(r) filter (where o and cd = t), 0) as hoje_s,
      count(*) filter (where o and cd > t) as prox_n, coalesce(sum(r) filter (where o and cd > t), 0) as prox_s,
      count(*) filter (where o and cd < t) as atr_n,  coalesce(sum(r) filter (where o and cd < t), 0) as atr_s,
      count(*) filter (where o and pp) as adi_n,      coalesce(sum(r) filter (where o and pp), 0) as adi_s,
      count(*) filter (where not o) as pag_n,         coalesce(sum(a) filter (where not o), 0) as pag_s
    from (
      select i.paid_amount < i.amount as o, i.amount - i.paid_amount as r, i.amount as a,
        i.collection_date as cd, i.collection_date <> i.original_due_date as pp, f.t
      from public.installments i
      join public.sales sa on sa.id = i.sale_id
      join public.customers c on c.id = i.customer_id
      cross join f
      -- Nenhuma aba inclui canceladas (status 'cancelled' tem precedência sobre 'paid').
      where not i.cancelled and sa.status <> 'cancelled'
        and (p_city is null or c.city_id = p_city)
        and (f.s = '' or c.full_name ilike '%' || f.s || '%'
             or (f.phone_pat is not null and (c.phone ilike f.phone_pat or c.whatsapp ilike f.phone_pat)))
    ) z
  ),
  pay as (
    -- payments.sale_id/installment_id são NOT NULL com FK: os joins internos de v_payments não filtram nada.
    select count(*) as n, coalesce(sum(p.amount), 0) as s
    from public.payments p
    join public.customers c on c.id = p.customer_id
    cross join f
    where p.status = 'pending_confirmation'
      and (p_city is null or c.city_id = p_city)
      and (f.s = '' or c.full_name ilike '%' || f.s || '%')
  )
  select jsonb_build_object(
    'todas',     jsonb_build_object('count', inst.todas_n, 'sum', inst.todas_s),
    'hoje',      jsonb_build_object('count', inst.hoje_n,  'sum', inst.hoje_s),
    'proximas',  jsonb_build_object('count', inst.prox_n,  'sum', inst.prox_s),
    'atrasadas', jsonb_build_object('count', inst.atr_n,   'sum', inst.atr_s),
    'adiadas',   jsonb_build_object('count', inst.adi_n,   'sum', inst.adi_s),
    'pagas',     jsonb_build_object('count', inst.pag_n,   'sum', inst.pag_s),
    'confirmar', jsonb_build_object('count', pay.n,        'sum', pay.s))
  from inst cross join pay
$$;

-- -----------------------------------------------------------------------------
-- Permissões
-- -----------------------------------------------------------------------------
revoke execute on function public.sales_totals(text, text, uuid, date, date) from public, anon;
revoke execute on function public.customers_open_balance(text, uuid, text, boolean) from public, anon;
revoke execute on function public.city_totals(uuid[]) from public, anon;
revoke execute on function public.collections_overview(text, uuid) from public, anon;
grant execute on function public.sales_totals(text, text, uuid, date, date) to authenticated;
grant execute on function public.customers_open_balance(text, uuid, text, boolean) to authenticated;
grant execute on function public.city_totals(uuid[]) to authenticated;
grant execute on function public.collections_overview(text, uuid) to authenticated;
