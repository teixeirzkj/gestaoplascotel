-- =============================================================================
-- PLASCOTEL — Relatórios, dashboard, notificações e agenda
--   1. dashboard_summary / report_summary: uma única passada sobre as parcelas em aberto
--   2. report_by_city: tudo pela cidade ATUAL do cliente + linha "Sem cidade / arquivadas"
--      (a soma das linhas fecha com report_summary)
--   3. customers_to_visit: "Pagamento adiado" mesmo quando o cliente também está em atraso
--   4. get_notifications: needs_return usa a configuração; não lidas e "cobrar hoje" não
--      são escondidas pelo limite
--   5. cities.next_visit_date / last_visit_date recalculadas diariamente (pg_cron)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Dashboard / resumo
-- Equivalências com v_installments: "em aberto" = paid_amount < amount, parcela e venda
-- não canceladas; overdue = collection_date < hoje; due_today = collection_date = hoje.
-- -----------------------------------------------------------------------------
create or replace function public.dashboard_summary() returns jsonb
language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'today', public.app_today(),
    'received_today', (select coalesce(sum(amount), 0) from public.payments where status = 'confirmed' and paid_on = public.app_today()),
    'received_today_count', (select count(*) from public.payments where status = 'confirmed' and paid_on = public.app_today()),
    'active_customers', (select count(*) from public.customers where archived_at is null),
    'pending_confirmations', (select count(*) from public.payments where status = 'pending_confirmation'),
    'broken_promises', (select count(*) from public.payment_promises where status = 'pending' and due_date < public.app_today()),
    'sold_month', (select coalesce(sum(total), 0) from public.sales where status <> 'cancelled'
                    and sale_date >= date_trunc('month', public.app_today())::date
                    and sale_date < (date_trunc('month', public.app_today()) + interval '1 month')::date),
    'received_month', (select coalesce(sum(amount), 0) from public.payments where status = 'confirmed'
                    and paid_on >= date_trunc('month', public.app_today())::date
                    and paid_on < (date_trunc('month', public.app_today()) + interval '1 month')::date)
  ) || (
    select jsonb_build_object(
      'total_receivable', coalesce(sum(o.r), 0),
      'customers_with_balance', count(distinct o.customer_id),
      'overdue_amount', coalesce(sum(o.r) filter (where o.d < o.t), 0),
      'overdue_count', count(*) filter (where o.d < o.t),
      'overdue_customers', count(distinct o.customer_id) filter (where o.d < o.t),
      'due_today_amount', coalesce(sum(o.r) filter (where o.d = o.t), 0),
      'due_today_count', count(*) filter (where o.d = o.t))
    from (
      select i.customer_id, i.amount - i.paid_amount as r, i.collection_date as d, public.app_today() as t
      from public.installments i join public.sales s on s.id = i.sale_id
      where i.paid_amount < i.amount and not i.cancelled and s.status <> 'cancelled'
    ) o
  )
$$;

create or replace function public.report_summary(p_from date, p_to date) returns jsonb
language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'from', p_from, 'to', p_to,
    'total_sold', (select coalesce(sum(total), 0) from public.sales where status <> 'cancelled' and sale_date between p_from and p_to),
    'sales_count', (select count(*) from public.sales where status <> 'cancelled' and sale_date between p_from and p_to),
    'paid_sales_count', (select count(*) from public.sales where status = 'paid' and sale_date between p_from and p_to),
    'total_received', (select coalesce(sum(amount), 0) from public.payments where status = 'confirmed' and paid_on between p_from and p_to),
    'received_by_method', (select jsonb_build_object(
        'pix', coalesce(sum(amount) filter (where method = 'pix'), 0),
        'cash', coalesce(sum(amount) filter (where method = 'cash'), 0),
        'transfer', coalesce(sum(amount) filter (where method = 'transfer'), 0),
        'other', coalesce(sum(amount) filter (where method = 'other'), 0))
      from public.payments where status = 'confirmed' and paid_on between p_from and p_to)
  ) || (
    select jsonb_build_object(
      'total_pending', coalesce(sum(o.r), 0),
      'total_overdue', coalesce(sum(o.r) filter (where o.d < o.t), 0),
      'delinquent_customers', count(distinct o.customer_id) filter (where o.d < o.t))
    from (
      select i.customer_id, i.amount - i.paid_amount as r, i.collection_date as d, public.app_today() as t
      from public.installments i join public.sales s on s.id = i.sale_id
      where i.paid_amount < i.amount and not i.cancelled and s.status <> 'cancelled'
    ) o
  )
$$;

-- -----------------------------------------------------------------------------
-- 2. Relatório por cidade
-- Todas as colunas usam a cidade atual do cliente (mesmo critério de v_installments).
-- Clientes sem cidade ou em cidade arquivada vão para a linha city_id = null, que só
-- aparece quando tem algum valor.
-- -----------------------------------------------------------------------------
create or replace function public.report_by_city(p_from date, p_to date) returns table (
  city_id uuid, city_name text, state text, total_sold numeric, total_received numeric,
  total_pending numeric, total_overdue numeric, customers_count bigint, overdue_customers bigint
)
language sql stable security invoker set search_path = public as $$
  with cust as (
    select c.id, c.archived_at, case when ci.id is not null and not ci.archived then ci.id end as cid
    from public.customers c left join public.cities ci on ci.id = c.city_id
  ),
  sold as (
    select cu.cid, sum(s.total) as v
    from public.sales s join cust cu on cu.id = s.customer_id
    where s.status <> 'cancelled' and s.sale_date between p_from and p_to
    group by cu.cid
  ),
  recv as (
    select cu.cid, sum(p.amount) as v
    from public.payments p join cust cu on cu.id = p.customer_id
    where p.status = 'confirmed' and p.paid_on between p_from and p_to
    group by cu.cid
  ),
  open_i as (
    select cu.cid,
      sum(i.amount - i.paid_amount) as pending,
      sum(i.amount - i.paid_amount) filter (where i.collection_date < public.app_today()) as overdue,
      count(distinct i.customer_id) filter (where i.collection_date < public.app_today()) as overdue_customers
    from public.installments i
    join public.sales s on s.id = i.sale_id
    join cust cu on cu.id = i.customer_id
    where i.paid_amount < i.amount and not i.cancelled and s.status <> 'cancelled'
    group by cu.cid
  ),
  cc as (
    select cu.cid, count(*) as n from cust cu where cu.archived_at is null group by cu.cid
  ),
  rows_ as (
    select ci.id, ci.name::text as name, ci.state::text as state from public.cities ci where not ci.archived
    union all
    select null::uuid, 'Sem cidade / arquivadas', null::text
  ),
  res as (
    select r.id, r.name, r.state,
      coalesce(sold.v, 0)::numeric as total_sold,
      coalesce(recv.v, 0)::numeric as total_received,
      coalesce(oi.pending, 0)::numeric as total_pending,
      coalesce(oi.overdue, 0)::numeric as total_overdue,
      coalesce(cc.n, 0)::bigint as customers_count,
      coalesce(oi.overdue_customers, 0)::bigint as overdue_customers
    from rows_ r
    left join sold on sold.cid is not distinct from r.id
    left join recv on recv.cid is not distinct from r.id
    left join open_i oi on oi.cid is not distinct from r.id
    left join cc on cc.cid is not distinct from r.id
  )
  select * from res
  where res.id is not null
     or res.total_sold > 0 or res.total_received > 0 or res.total_pending > 0 or res.customers_count > 0
  order by (res.id is null), res.total_pending desc, res.name
$$;

-- -----------------------------------------------------------------------------
-- 3. Clientes a visitar
-- -----------------------------------------------------------------------------
create or replace function public.customers_to_visit(p_city_id uuid) returns table (
  customer_id uuid, full_name text, phone text, neighborhood text, address text, reference text,
  balance numeric, overdue_amount numeric, next_collection_date date, needs_visit boolean,
  has_postponement boolean, has_broken_promise boolean, reason text
)
language sql stable security invoker set search_path = public as $$
  select c.id, c.full_name, coalesce(c.whatsapp, c.phone), c.neighborhood, c.address, c.reference,
    c.balance, c.overdue_amount, c.next_collection_date,
    f.needs_visit, f.postponed, f.broken,
    concat_ws(' · ',
      case when c.overdue_amount > 0 then 'Em atraso: ' || public.fmt_brl(c.overdue_amount) end,
      case when f.postponed then 'Pagamento adiado' end,
      case when f.needs_visit then 'Pediu visita presencial' end,
      case when f.broken then 'Promessa não cumprida' end,
      case when c.financial_status = 'pending' then 'Pendência para conferir' end,
      case when c.overdue_amount = 0 and c.financial_status in ('up_to_date') and c.next_collection_date <= public.app_today() + 7 then 'Cobrança próxima' end
    )
  from public.v_customers c
  cross join lateral (
    select
      exists (select 1 from public.installments i join public.sales s on s.id = i.sale_id
              where i.customer_id = c.id and i.needs_visit and i.paid_amount < i.amount and not i.cancelled and s.status <> 'cancelled') as needs_visit,
      -- mesmo critério de postponed_count em v_customers (independe da precedência de 'overdue')
      exists (select 1 from public.installments i join public.sales s on s.id = i.sale_id
              where i.customer_id = c.id and not i.cancelled and s.status <> 'cancelled' and i.paid_amount < i.amount
                and i.collection_date > i.original_due_date and i.collection_date > public.app_today()) as postponed,
      exists (select 1 from public.payment_promises p
              where p.customer_id = c.id and p.status = 'pending' and p.due_date < public.app_today()) as broken
  ) f
  where c.city_id = p_city_id and c.archived_at is null and c.balance > 0
    and (c.overdue_amount > 0 or f.postponed or c.financial_status = 'pending'
         or c.next_collection_date <= public.app_today() + 7
         or f.needs_visit)
  order by c.overdue_amount desc, c.next_collection_date nulls last
$$;

-- -----------------------------------------------------------------------------
-- 4. Notificações
-- -----------------------------------------------------------------------------
create or replace function public.get_notifications() returns table (
  key text, kind text, severity text, title text, body text, link text, customer_id uuid, ref_date date, is_read boolean
)
language sql stable security invoker set search_path = public as $$
  with cfg as (
    select coalesce((select (value->>'due_soon_days')::int from public.app_settings where key = 'billing'), 3) as due_soon,
           coalesce((select (value->>'visit_soon_days')::int from public.app_settings where key = 'billing'), 3) as visit_soon
  ),
  -- Uma única leitura das parcelas em aberto, reaproveitada pelos tipos abaixo
  oi as materialized (
    select v.* from public.v_installments v where v.status not in ('paid', 'cancelled')
  ),
  n as (
    select 'due_today:' || v.id || ':' || v.collection_date as key, 'due_today' as kind, 'warning' as severity,
      'Cobrar hoje: ' || v.customer_name as title,
      public.fmt_brl(v.remaining) || ' · ' || coalesce(v.city_name, 'Sem cidade') || ' · venda #' || v.sale_code as body,
      '/clientes/' || v.customer_id as link, v.customer_id, v.collection_date as ref_date
    from oi v where v.status = 'due_today'
    union all
    select 'overdue:' || v.id || ':' || v.collection_date, 'overdue', 'danger',
      'Parcela atrasada: ' || v.customer_name,
      public.fmt_brl(v.remaining) || ' · ' || v.days_overdue || ' dia(s) de atraso',
      '/clientes/' || v.customer_id, v.customer_id, v.collection_date
    from oi v where v.status = 'overdue'
    union all
    select 'due_soon:' || v.id || ':' || v.collection_date, 'due_soon', 'info',
      'Vence em breve: ' || v.customer_name,
      public.fmt_brl(v.remaining) || ' em ' || public.fmt_date(v.collection_date),
      '/clientes/' || v.customer_id, v.customer_id, v.collection_date
    from oi v, cfg
    where v.status in ('upcoming', 'postponed') and v.collection_date <= public.app_today() + cfg.due_soon
    union all
    select 'promise:' || p.id, 'broken_promise', 'danger',
      'Promessa não cumprida: ' || p.customer_name,
      public.fmt_brl(p.amount) || ' combinado para ' || public.fmt_date(p.due_date),
      '/clientes/' || p.customer_id, p.customer_id, p.due_date
    from public.v_promises p where p.effective_status = 'broken'
    union all
    select 'visit:' || vi.id || ':' || vi.visit_date, 'visit_soon', 'info',
      'Visita próxima: ' || ci.name,
      public.fmt_date(vi.visit_date) || coalesce(' às ' || to_char(vi.visit_time, 'HH24:MI'), ''),
      '/agenda/' || vi.id, null::uuid, vi.visit_date
    from public.visits vi join public.cities ci on ci.id = vi.city_id, cfg
    where vi.status = 'planned' and vi.visit_date between public.app_today() and public.app_today() + cfg.visit_soon
    union all
    select 'confirm:' || p.id, 'pending_confirmation', 'warning',
      'Confirmar recebimento: ' || p.customer_name,
      public.fmt_brl(p.amount) || ' via ' || public.method_label(p.method),
      '/cobrancas?aba=confirmar', p.customer_id, p.paid_on
    from public.v_payments p where p.status = 'pending_confirmation'
    union all
    -- Parcelas já atrasadas têm o próprio aviso; aqui só as de hoje/próximas que pedem visita.
    select 'needs_visit:' || v.id || ':' || v.collection_date, 'needs_return', 'info',
      'Precisa de retorno: ' || v.customer_name,
      'Visita presencial solicitada · ' || coalesce(v.city_name, 'Sem cidade'),
      '/clientes/' || v.customer_id, v.customer_id, v.collection_date
    from oi v, cfg
    where v.needs_visit and v.status <> 'overdue' and v.collection_date <= public.app_today() + cfg.due_soon
  ),
  r as (
    select n.*,
      exists (select 1 from public.notification_reads nr where nr.user_id = auth.uid() and nr.notification_key = n.key) as is_read,
      row_number() over (partition by n.kind order by n.ref_date, n.key) as rn
    from n
  )
  select r.key, r.kind, r.severity, r.title, r.body, r.link, r.customer_id, r.ref_date, r.is_read
  from r
  where r.rn <= 100 -- nenhum tipo sozinho ocupa a lista inteira
  order by r.is_read,
    case r.kind when 'due_today' then 0 else 1 end,
    case r.severity when 'danger' then 1 when 'warning' then 2 else 3 end,
    r.ref_date
  limit 200
$$;

-- -----------------------------------------------------------------------------
-- 5. Datas de visita das cidades
-- next_visit_date é gravada por trigger em visits; sem recálculo diário ela fica no
-- passado quando a data chega e ninguém altera a visita.
-- -----------------------------------------------------------------------------
create or replace function public.refresh_all_city_visit_dates() returns void
language sql security definer set search_path = public as $$
  update public.cities c set
    last_visit_date = x.last_visit, next_visit_date = x.next_visit
  from (
    select ci.id,
      (select max(v.visit_date) from public.visits v where v.city_id = ci.id and v.status = 'done') as last_visit,
      (select min(v.visit_date) from public.visits v where v.city_id = ci.id and v.status = 'planned' and v.visit_date >= public.app_today()) as next_visit
    from public.cities ci
  ) x
  where c.id = x.id
    and (c.last_visit_date is distinct from x.last_visit or c.next_visit_date is distinct from x.next_visit);
$$;
revoke execute on function public.refresh_all_city_visit_dates() from public, anon, authenticated;

select public.refresh_all_city_visit_dates();

create extension if not exists pg_cron with schema pg_catalog;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'plascotel_refresh_city_visit_dates') then
    perform cron.unschedule('plascotel_refresh_city_visit_dates');
  end if;
  -- 00:05 em America/Bahia (UTC-3)
  perform cron.schedule('plascotel_refresh_city_visit_dates', '5 3 * * *', 'select public.refresh_all_city_visit_dates()');
end $$;
