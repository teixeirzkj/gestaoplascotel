-- =============================================================================
-- PLASCOTEL — Regras de negócio, views, auditoria e RPCs transacionais
-- Toda operação financeira passa por uma função SECURITY DEFINER que:
--   1. valida o usuário/papel   2. trava as linhas envolvidas (FOR UPDATE)
--   3. valida valores no servidor   4. registra auditoria
-- =============================================================================

alter table public.sales add column idempotency_key uuid unique;

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
create or replace function public.fmt_brl(v numeric) returns text
language sql immutable as $$
  select 'R$ ' || translate(to_char(coalesce(v,0), 'FM999G999G990D00'), ',.', '.,')
$$;
-- to_char usa locale C => G=',' D='.'; translate troca para padrão brasileiro.

create or replace function public.fmt_date(d date) returns text
language sql immutable as $$ select to_char(d, 'DD/MM/YYYY') $$;

create or replace function public.method_label(m public.payment_method) returns text
language sql immutable as $$
  select case m when 'pix' then 'Pix' when 'cash' then 'Dinheiro' when 'transfer' then 'Transferência' when 'other' then 'Outro' else '—' end
$$;

create or replace function public.log_activity(
  p_action text, p_entity_type text, p_entity_id uuid, p_customer_id uuid,
  p_summary text, p_old jsonb default null, p_new jsonb default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.activity_logs (actor_id, action, entity_type, entity_id, customer_id, summary, old_data, new_data)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, p_customer_id, p_summary, p_old, p_new);
end $$;

create or replace function public.assert_active() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_active_user() then
    raise exception 'Usuário não autenticado ou inativo' using errcode = '42501';
  end if;
end $$;

create or replace function public.assert_owner() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'Operação permitida apenas ao proprietário' using errcode = '42501';
  end if;
end $$;

-- Diferença entre dois jsonb (apenas chaves alteradas, ignorando updated_at)
create or replace function public.jsonb_diff(p_old jsonb, p_new jsonb, out o jsonb, out n jsonb)
language plpgsql immutable as $$
declare k text;
begin
  o := '{}'::jsonb; n := '{}'::jsonb;
  for k in select jsonb_object_keys(p_new) loop
    if k in ('updated_at') then continue; end if;
    if (p_old -> k) is distinct from (p_new -> k) then
      o := o || jsonb_build_object(k, p_old -> k);
      n := n || jsonb_build_object(k, p_new -> k);
    end if;
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Auditoria por trigger (cadastros)
-- -----------------------------------------------------------------------------
create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb; v_new jsonb; v_o jsonb; v_n jsonb;
  v_customer uuid; v_summary text; v_label text;
begin
  v_label := case tg_table_name
    when 'customers' then 'Cliente' when 'products' then 'Produto' when 'cities' then 'Cidade'
    when 'visits' then 'Visita' when 'app_settings' then 'Configuração' when 'profiles' then 'Usuário'
    else tg_table_name end;

  if tg_op = 'INSERT' then
    v_new := to_jsonb(new);
    v_customer := case when tg_table_name = 'customers' then new.id end;
    v_summary := case tg_table_name
      when 'customers' then 'Cliente cadastrado: ' || new.full_name
      when 'products' then 'Produto cadastrado: ' || new.name
      when 'cities' then 'Cidade cadastrada: ' || new.name || '/' || new.state
      when 'visits' then 'Visita agendada para ' || public.fmt_date(new.visit_date)
      else v_label || ' criado(a)' end;
    perform public.log_activity('create', tg_table_name, (v_new->>'id')::uuid, v_customer, v_summary, null, v_new);
    return new;
  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old); v_new := to_jsonb(new);
    select o, n into v_o, v_n from public.jsonb_diff(v_old, v_new);
    if v_n = '{}'::jsonb then return new; end if;
    v_customer := case when tg_table_name = 'customers' then new.id end;
    v_summary := case
      when tg_table_name = 'customers' and v_n ? 'archived_at' and new.archived_at is not null then 'Cliente arquivado'
      when tg_table_name = 'customers' and v_n ? 'archived_at' and new.archived_at is null then 'Cliente reativado'
      when tg_table_name = 'customers' and (select count(*) from jsonb_object_keys(v_n)) = 1 and v_n ? 'last_contact_at' then null
      when tg_table_name = 'customers' then 'Dados do cliente alterados'
      when tg_table_name = 'visits' and v_n ? 'status' then 'Visita ' || case new.status when 'done' then 'realizada' when 'cancelled' then 'cancelada' else 'reaberta' end || ' (' || public.fmt_date(new.visit_date) || ')'
      when tg_table_name = 'profiles' and v_n ? 'role' then 'Papel do usuário ' || new.full_name || ' alterado para ' || case new.role when 'owner' then 'proprietário' else 'funcionário' end
      when tg_table_name = 'profiles' and v_n ? 'active' then 'Usuário ' || new.full_name || case when new.active then ' reativado' else ' desativado' end
      else v_label || ' alterado(a)' end;
    if v_summary is null then return new; end if;
    perform public.log_activity('update', tg_table_name, coalesce((v_new->>'id')::uuid, null), v_customer, v_summary, v_o, v_n);
    return new;
  else
    v_old := to_jsonb(old);
    perform public.log_activity('delete', tg_table_name, (v_old->>'id')::uuid, null, v_label || ' removido(a)', v_old, null);
    return old;
  end if;
end $$;

create trigger customers_audit after insert or update on public.customers for each row execute function public.audit_row();
create trigger products_audit after insert or update on public.products for each row execute function public.audit_row();
create trigger cities_audit after insert or update on public.cities for each row execute function public.audit_row();
create trigger visits_audit after insert or update or delete on public.visits for each row execute function public.audit_row();
create trigger profiles_audit after update on public.profiles for each row execute function public.audit_row();

create or replace function public.audit_settings() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.log_activity('update', 'app_settings', null, null, 'Configuração alterada: ' || new.key,
    case when tg_op = 'UPDATE' then jsonb_build_object(new.key, old.value) end, jsonb_build_object(new.key, new.value));
  return new;
end $$;
create trigger app_settings_audit after insert or update on public.app_settings for each row execute function public.audit_settings();

-- Observações: auditoria + último contato
create or replace function public.on_customer_note() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.log_activity('note', 'customer_notes', new.id, new.customer_id,
    case new.kind when 'contact' then 'Contato registrado: ' when 'collection' then 'Cobrança realizada: ' else 'Observação: ' end || left(new.body, 280),
    null, to_jsonb(new));
  if new.kind in ('contact', 'collection') then
    update public.customers set last_contact_at = now() where id = new.customer_id;
  end if;
  return new;
end $$;
create trigger customer_notes_after after insert on public.customer_notes for each row execute function public.on_customer_note();

-- Comprovantes: auditoria
create or replace function public.on_receipt() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_customer uuid;
begin
  select customer_id into v_customer from public.payments where id = new.payment_id;
  perform public.log_activity('receipt', 'payment_receipts', new.id, v_customer,
    'Comprovante anexado: ' || new.file_name, null, to_jsonb(new));
  return new;
end $$;
create trigger payment_receipts_after after insert on public.payment_receipts for each row execute function public.on_receipt();

-- Visitas: datas da cidade + auditoria por cliente
create or replace function public.refresh_city_visit_dates(p_city uuid) returns void
language sql security definer set search_path = public as $$
  update public.cities c set
    last_visit_date = (select max(visit_date) from public.visits where city_id = p_city and status = 'done'),
    next_visit_date = (select min(visit_date) from public.visits where city_id = p_city and status = 'planned' and visit_date >= public.app_today())
  where c.id = p_city;
$$;

create or replace function public.on_visit_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then perform public.refresh_city_visit_dates(old.city_id); end if;
  if tg_op in ('INSERT', 'UPDATE') then perform public.refresh_city_visit_dates(new.city_id); end if;
  return null;
end $$;
create trigger visits_city_dates after insert or update or delete on public.visits for each row execute function public.on_visit_change();

create or replace function public.visit_status_label(s public.visit_customer_status) returns text
language sql immutable as $$
  select case s when 'to_visit' then 'A visitar' when 'visited' then 'Visitado' when 'not_found' then 'Não encontrado'
    when 'payment_received' then 'Pagamento recebido' when 'rescheduled' then 'Nova data combinada' end
$$;

create or replace function public.on_visit_customer() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_date date; v_city text;
begin
  select v.visit_date, c.name into v_date, v_city from public.visits v join public.cities c on c.id = v.city_id where v.id = new.visit_id;
  if tg_op = 'INSERT' then
    perform public.log_activity('visit', 'visit_customers', new.id, new.customer_id,
      'Incluído na visita de ' || v_city || ' em ' || public.fmt_date(v_date), null, to_jsonb(new));
  elsif new.status is distinct from old.status then
    perform public.log_activity('visit', 'visit_customers', new.id, new.customer_id,
      'Visita (' || v_city || ', ' || public.fmt_date(v_date) || '): ' || public.visit_status_label(new.status)
        || coalesce(' — ' || nullif(new.notes, ''), ''),
      jsonb_build_object('status', old.status), jsonb_build_object('status', new.status));
    if new.status <> 'to_visit' then
      update public.customers set last_contact_at = now() where id = new.customer_id;
    end if;
  end if;
  return new;
end $$;
create trigger visit_customers_after after insert or update on public.visit_customers for each row execute function public.on_visit_customer();

-- -----------------------------------------------------------------------------
-- Views (security_invoker => respeitam RLS do usuário)
-- -----------------------------------------------------------------------------
create or replace view public.v_installments with (security_invoker = true) as
select
  i.id, i.sale_id, s.code as sale_code, i.customer_id, c.full_name as customer_name,
  c.phone as customer_phone, c.whatsapp as customer_whatsapp, c.city_id, ci.name as city_name,
  i.number, i.amount, i.paid_amount, (i.amount - i.paid_amount) as remaining,
  coalesce((select sum(p.amount) from public.payments p where p.installment_id = i.id and p.status = 'pending_confirmation'), 0)::numeric(12,2) as pending_confirmation_amount,
  i.original_due_date, i.collection_date, i.needs_visit, i.expected_channel, i.postponed_count, i.notes, i.paid_at,
  (i.collection_date <> i.original_due_date) as is_postponed,
  case
    when i.cancelled or s.status = 'cancelled' then 'cancelled'
    when i.paid_amount >= i.amount then 'paid'
    when i.collection_date < public.app_today() then 'overdue'
    when i.collection_date = public.app_today() then 'due_today'
    when i.collection_date > i.original_due_date then 'postponed'
    else 'upcoming'
  end as status,
  case when i.paid_amount < i.amount and not i.cancelled and s.status <> 'cancelled' and i.collection_date < public.app_today()
       then public.app_today() - i.original_due_date else 0 end as days_overdue,
  (i.paid_amount > 0 and i.paid_amount < i.amount) as is_partial,
  c.archived_at is not null as customer_archived
from public.installments i
join public.sales s on s.id = i.sale_id
join public.customers c on c.id = i.customer_id
left join public.cities ci on ci.id = c.city_id;

create or replace view public.v_sales as
select
  s.*, c.full_name as customer_name, ci.name as city_name,
  coalesce(x.paid, 0)::numeric(12,2) as paid_total,
  case when s.status = 'cancelled' then 0 else (s.total - coalesce(x.paid, 0)) end::numeric(12,2) as balance,
  coalesce(x.open_count, 0) as open_installments,
  x.next_collection_date
from public.sales s
join public.customers c on c.id = s.customer_id
left join public.cities ci on ci.id = s.city_id
left join lateral (
  select sum(i.paid_amount) as paid,
         count(*) filter (where i.paid_amount < i.amount and not i.cancelled) as open_count,
         min(i.collection_date) filter (where i.paid_amount < i.amount and not i.cancelled) as next_collection_date
  from public.installments i where i.sale_id = s.id
) x on true;
alter view public.v_sales set (security_invoker = true);

create or replace view public.v_customers with (security_invoker = true) as
select
  c.*, ci.name as city_name, ci.state as city_state,
  coalesce(s.total_purchased, 0)::numeric(12,2) as total_purchased,
  coalesce(s.sales_count, 0) as sales_count,
  coalesce(i.total_paid, 0)::numeric(12,2) as total_paid,
  coalesce(i.balance, 0)::numeric(12,2) as balance,
  coalesce(i.overdue_amount, 0)::numeric(12,2) as overdue_amount,
  coalesce(i.open_count, 0) as open_installments,
  i.next_collection_date,
  (select max(p.paid_on) from public.payments p where p.customer_id = c.id and p.status = 'confirmed') as last_payment_date,
  (select max(p.created_at) from public.payments p where p.customer_id = c.id and p.status = 'confirmed') as last_payment_at,
  case
    when coalesce(s.sales_count, 0) = 0 then 'no_sales'
    when coalesce(i.overdue_count, 0) > 0 then 'overdue'
    when coalesce(i.postponed_count, 0) > 0 then 'postponed'
    when coalesce(i.balance, 0) = 0 then 'paid_off'
    when exists (select 1 from public.payments p where p.customer_id = c.id and p.status = 'pending_confirmation')
      or exists (select 1 from public.payment_promises pp where pp.customer_id = c.id and pp.status = 'pending' and pp.due_date < public.app_today())
      or coalesce(i.due_today_count, 0) > 0
      then 'pending'
    else 'up_to_date'
  end as financial_status
from public.customers c
left join public.cities ci on ci.id = c.city_id
left join lateral (
  select sum(total) as total_purchased, count(*) as sales_count
  from public.sales where customer_id = c.id and status <> 'cancelled'
) s on true
left join lateral (
  select
    sum(x.paid_amount) as total_paid,
    sum(x.amount - x.paid_amount) as balance,
    sum(x.amount - x.paid_amount) filter (where x.collection_date < public.app_today()) as overdue_amount,
    count(*) filter (where x.paid_amount < x.amount) as open_count,
    count(*) filter (where x.paid_amount < x.amount and x.collection_date < public.app_today()) as overdue_count,
    count(*) filter (where x.paid_amount < x.amount and x.collection_date = public.app_today()) as due_today_count,
    count(*) filter (where x.paid_amount < x.amount and x.collection_date > x.original_due_date and x.collection_date > public.app_today()) as postponed_count,
    min(x.collection_date) filter (where x.paid_amount < x.amount) as next_collection_date
  from public.installments x
  join public.sales sx on sx.id = x.sale_id
  where x.customer_id = c.id and not x.cancelled and sx.status <> 'cancelled'
) i on true;

create or replace view public.v_promises with (security_invoker = true) as
select pp.*, c.full_name as customer_name, ci.name as city_name, c.phone as customer_phone,
  case when pp.status = 'pending' and pp.due_date < public.app_today() then 'broken' else pp.status::text end as effective_status
from public.payment_promises pp
join public.customers c on c.id = pp.customer_id
left join public.cities ci on ci.id = c.city_id;

create or replace view public.v_payments with (security_invoker = true) as
select p.*, c.full_name as customer_name, ci.name as city_name, s.code as sale_code, i.number as installment_number,
  pr.full_name as created_by_name, pc.full_name as confirmed_by_name,
  (select count(*) from public.payment_receipts r where r.payment_id = p.id) as receipts_count
from public.payments p
join public.customers c on c.id = p.customer_id
left join public.cities ci on ci.id = c.city_id
join public.sales s on s.id = p.sale_id
join public.installments i on i.id = p.installment_id
left join public.profiles pr on pr.id = p.created_by
left join public.profiles pc on pc.id = p.confirmed_by;

create or replace view public.v_activity with (security_invoker = true) as
select a.*, pr.full_name as actor_name, c.full_name as customer_name
from public.activity_logs a
left join public.profiles pr on pr.id = a.actor_id
left join public.customers c on c.id = a.customer_id;

create or replace view public.v_cash_movements with (security_invoker = true) as
select m.*, pr.full_name as created_by_name, p.customer_id, c.full_name as customer_name
from public.cash_movements m
left join public.profiles pr on pr.id = m.created_by
left join public.payments p on p.id = m.payment_id
left join public.customers c on c.id = p.customer_id;

-- -----------------------------------------------------------------------------
-- Internos
-- -----------------------------------------------------------------------------
create or replace function public._refresh_sale_status(p_sale uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_status public.sale_status; v_open int; v_new public.sale_status; v_customer uuid; v_code bigint;
begin
  select status, customer_id, code into v_status, v_customer, v_code from public.sales where id = p_sale for update;
  if v_status = 'cancelled' then return; end if;
  select count(*) into v_open from public.installments where sale_id = p_sale and not cancelled and paid_amount < amount;
  v_new := case when v_open = 0 then 'paid' else 'open' end;
  if v_new <> v_status then
    update public.sales set status = v_new where id = p_sale;
    perform public.log_activity(case when v_new = 'paid' then 'sale_paid' else 'sale_reopened' end, 'sales', p_sale, v_customer,
      case when v_new = 'paid' then 'Venda #' || v_code || ' quitada' else 'Venda #' || v_code || ' reaberta (saldo pendente)' end);
  end if;
end $$;

create or replace function public._apply_payment_confirmation(p_payment uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  p public.payments%rowtype; i public.installments%rowtype; v_code bigint;
begin
  select * into p from public.payments where id = p_payment for update;
  if p.status <> 'pending_confirmation' then
    raise exception 'Este pagamento não está aguardando confirmação' using errcode = 'P0001';
  end if;
  select * into i from public.installments where id = p.installment_id for update;
  if p.amount > (i.amount - i.paid_amount) then
    raise exception 'Valor (%) superior ao saldo da parcela (%)', public.fmt_brl(p.amount), public.fmt_brl(i.amount - i.paid_amount) using errcode = 'P0001';
  end if;

  update public.installments set
    paid_amount = paid_amount + p.amount,
    paid_at = case when paid_amount + p.amount >= amount then p.paid_on else null end,
    needs_visit = case when paid_amount + p.amount >= amount then false else needs_visit end
  where id = i.id;

  update public.payments set status = 'confirmed', confirmed_by = auth.uid(), confirmed_at = now() where id = p.id;

  select code into v_code from public.sales where id = p.sale_id;
  insert into public.cash_movements (kind, payment_id, amount, method, occurred_on, description, created_by)
  values ('payment', p.id, p.amount, p.method, p.paid_on,
          'Recebimento venda #' || v_code || case when i.number = 0 then ' (entrada)' else ' parcela ' || i.number end, auth.uid());

  perform public.log_activity(
    case when p.amount < (i.amount - i.paid_amount) then 'payment_partial' else 'payment' end,
    'payments', p.id, p.customer_id,
    'Pagamento de ' || public.fmt_brl(p.amount) || ' via ' || public.method_label(p.method) || ' confirmado — venda #' || v_code
      || case when i.number = 0 then ' (entrada)' else ', parcela ' || i.number end
      || case when p.amount < (i.amount - i.paid_amount) then ' (parcial, restam ' || public.fmt_brl(i.amount - i.paid_amount - p.amount) || ')' else '' end,
    null, jsonb_build_object('amount', p.amount, 'method', p.method, 'paid_on', p.paid_on));

  if i.paid_amount + p.amount >= i.amount then
    perform public.log_activity('installment_paid', 'installments', i.id, p.customer_id,
      'Parcela ' || case when i.number = 0 then 'de entrada' else i.number::text end || ' da venda #' || v_code || ' quitada');
  end if;

  -- Promessas pendentes cumpridas: soma confirmada desde a data da promessa cobre o valor
  update public.payment_promises pp set status = 'kept', resolved_at = now(), resolved_by = auth.uid()
  where pp.customer_id = p.customer_id and pp.status = 'pending'
    and (pp.installment_id is null or pp.installment_id = i.id)
    and (select coalesce(sum(x.amount), 0) from public.payments x
         where x.customer_id = pp.customer_id and x.status = 'confirmed' and x.paid_on >= pp.promised_on
           and (pp.installment_id is null or x.installment_id = pp.installment_id)) >= pp.amount;

  perform public._refresh_sale_status(p.sale_id);
end $$;

-- -----------------------------------------------------------------------------
-- RPC: Vendas
-- -----------------------------------------------------------------------------
-- p: { customer_id, city_id?, sale_date, discount, down_payment, down_payment_method, down_payment_received,
--      payment_method, conditions, notes, idempotency_key,
--      items: [{product_id?, description, quantity, unit_price, discount}],
--      installments: [{amount, due_date}] }
create or replace function public.create_sale(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_sale uuid; v_customer public.customers%rowtype; v_item jsonb; v_inst jsonb;
  v_subtotal numeric(12,2) := 0; v_line numeric(12,2); v_discount numeric(12,2); v_total numeric(12,2);
  v_down numeric(12,2); v_inst_sum numeric(12,2) := 0; v_n int := 0; v_key uuid; v_sale_date date;
  v_down_inst uuid; v_pay uuid; v_code bigint; v_items_count int;
begin
  perform public.assert_owner();
  v_key := nullif(p->>'idempotency_key', '')::uuid;
  if v_key is null then raise exception 'Chave de idempotência obrigatória' using errcode = 'P0001'; end if;
  select id into v_sale from public.sales where idempotency_key = v_key;
  if v_sale is not null then return v_sale; end if;

  select * into v_customer from public.customers where id = (p->>'customer_id')::uuid;
  if v_customer.id is null then raise exception 'Cliente não encontrado' using errcode = 'P0001'; end if;
  if v_customer.archived_at is not null then raise exception 'Cliente arquivado não pode receber vendas' using errcode = 'P0001'; end if;

  v_sale_date := coalesce((p->>'sale_date')::date, public.app_today());
  if v_sale_date > public.app_today() then raise exception 'A data da venda não pode estar no futuro' using errcode = 'P0001'; end if;

  v_items_count := jsonb_array_length(coalesce(p->'items', '[]'::jsonb));
  if v_items_count = 0 then raise exception 'Inclua ao menos um produto' using errcode = 'P0001'; end if;

  for v_item in select * from jsonb_array_elements(p->'items') loop
    if coalesce((v_item->>'quantity')::numeric, 0) <= 0 then raise exception 'Quantidade inválida' using errcode = 'P0001'; end if;
    if coalesce((v_item->>'unit_price')::numeric, -1) < 0 then raise exception 'Preço unitário inválido' using errcode = 'P0001'; end if;
    v_line := round((v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric, 2) - coalesce((v_item->>'discount')::numeric, 0);
    if v_line < 0 then raise exception 'Desconto do item maior que o valor do item' using errcode = 'P0001'; end if;
    v_subtotal := v_subtotal + v_line;
  end loop;

  v_discount := coalesce((p->>'discount')::numeric, 0);
  if v_discount < 0 or v_discount > v_subtotal then raise exception 'Desconto inválido' using errcode = 'P0001'; end if;
  v_total := v_subtotal - v_discount;
  if v_total <= 0 then raise exception 'O valor total da venda deve ser maior que zero' using errcode = 'P0001'; end if;

  v_down := coalesce((p->>'down_payment')::numeric, 0);
  if v_down < 0 or v_down > v_total then raise exception 'Entrada inválida' using errcode = 'P0001'; end if;

  for v_inst in select * from jsonb_array_elements(coalesce(p->'installments', '[]'::jsonb)) loop
    if coalesce((v_inst->>'amount')::numeric, 0) <= 0 then raise exception 'Parcela com valor inválido' using errcode = 'P0001'; end if;
    if (v_inst->>'due_date') is null then raise exception 'Parcela sem vencimento' using errcode = 'P0001'; end if;
    v_inst_sum := v_inst_sum + (v_inst->>'amount')::numeric;
    v_n := v_n + 1;
  end loop;

  if v_inst_sum + v_down <> v_total then
    raise exception 'A soma da entrada e das parcelas (%) difere do total da venda (%)', public.fmt_brl(v_inst_sum + v_down), public.fmt_brl(v_total) using errcode = 'P0001';
  end if;

  insert into public.sales (customer_id, city_id, sale_date, subtotal, discount, total, down_payment, payment_method,
                            conditions, installments_count, notes, created_by, idempotency_key)
  values (v_customer.id, coalesce(nullif(p->>'city_id', '')::uuid, v_customer.city_id), v_sale_date, v_subtotal, v_discount, v_total, v_down,
          nullif(p->>'payment_method', '')::public.payment_method, nullif(p->>'conditions', ''), v_n, nullif(p->>'notes', ''), auth.uid(), v_key)
  returning id, code into v_sale, v_code;

  for v_item in select * from jsonb_array_elements(p->'items') loop
    insert into public.sale_items (sale_id, product_id, description, quantity, unit_price, discount, total)
    values (v_sale, nullif(v_item->>'product_id', '')::uuid,
            coalesce(nullif(trim(v_item->>'description'), ''), (select name from public.products where id = nullif(v_item->>'product_id', '')::uuid), 'Item'),
            (v_item->>'quantity')::numeric, (v_item->>'unit_price')::numeric, coalesce((v_item->>'discount')::numeric, 0),
            round((v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric, 2) - coalesce((v_item->>'discount')::numeric, 0));
  end loop;

  if v_down > 0 then
    insert into public.installments (sale_id, customer_id, number, amount, original_due_date, collection_date)
    values (v_sale, v_customer.id, 0, v_down, v_sale_date, v_sale_date) returning id into v_down_inst;
  end if;

  v_n := 0;
  for v_inst in select * from jsonb_array_elements(coalesce(p->'installments', '[]'::jsonb)) loop
    v_n := v_n + 1;
    insert into public.installments (sale_id, customer_id, number, amount, original_due_date, collection_date)
    values (v_sale, v_customer.id, v_n, (v_inst->>'amount')::numeric, (v_inst->>'due_date')::date, (v_inst->>'due_date')::date);
  end loop;

  perform public.log_activity('sale', 'sales', v_sale, v_customer.id,
    'Venda #' || v_code || ' de ' || public.fmt_brl(v_total)
      || case when v_n > 0 then ' — ' || case when v_down > 0 then 'entrada de ' || public.fmt_brl(v_down) || ' + ' else '' end || v_n || 'x parcelas' else ' à vista' end,
    null, jsonb_build_object('total', v_total, 'down_payment', v_down, 'installments', v_n, 'items', v_items_count));

  if v_down > 0 and coalesce((p->>'down_payment_received')::boolean, false) then
    insert into public.payments (installment_id, sale_id, customer_id, amount, paid_on, method, notes, status, idempotency_key, created_by)
    values (v_down_inst, v_sale, v_customer.id, v_down, v_sale_date,
            coalesce(nullif(p->>'down_payment_method', '')::public.payment_method, nullif(p->>'payment_method', '')::public.payment_method, 'cash'),
            'Entrada recebida no ato da venda', 'pending_confirmation', gen_random_uuid(), auth.uid())
    returning id into v_pay;
    perform public._apply_payment_confirmation(v_pay);
  end if;

  return v_sale;
end $$;

create or replace function public.cancel_sale(p_sale_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare s public.sales%rowtype;
begin
  perform public.assert_owner();
  if coalesce(length(trim(p_reason)), 0) < 5 then raise exception 'Informe o motivo do cancelamento (mínimo 5 caracteres)' using errcode = 'P0001'; end if;
  select * into s from public.sales where id = p_sale_id for update;
  if s.id is null then raise exception 'Venda não encontrada' using errcode = 'P0001'; end if;
  if s.status = 'cancelled' then raise exception 'Venda já cancelada' using errcode = 'P0001'; end if;
  if exists (select 1 from public.payments where sale_id = p_sale_id and status in ('confirmed', 'pending_confirmation')) then
    raise exception 'Existem pagamentos ativos nesta venda. Estorne/rejeite-os antes de cancelar.' using errcode = 'P0001';
  end if;
  update public.sales set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(), cancel_reason = p_reason where id = p_sale_id;
  update public.installments set cancelled = true where sale_id = p_sale_id;
  perform public.log_activity('sale_cancelled', 'sales', p_sale_id, s.customer_id,
    'Venda #' || s.code || ' cancelada — ' || p_reason, jsonb_build_object('status', s.status), jsonb_build_object('status', 'cancelled'));
end $$;

-- -----------------------------------------------------------------------------
-- RPC: Pagamentos
-- -----------------------------------------------------------------------------
create or replace function public.register_payment(
  p_installment_id uuid, p_amount numeric, p_paid_on date, p_method public.payment_method,
  p_notes text, p_confirm boolean, p_idempotency_key uuid
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid; i public.installments%rowtype; s public.sales%rowtype; v_pending numeric(12,2); v_available numeric(12,2);
begin
  perform public.assert_active();
  if p_idempotency_key is null then raise exception 'Chave de idempotência obrigatória' using errcode = 'P0001'; end if;
  select id into v_id from public.payments where idempotency_key = p_idempotency_key;
  if v_id is not null then return v_id; end if;

  if p_amount is null or p_amount <= 0 then raise exception 'Informe um valor maior que zero' using errcode = 'P0001'; end if;
  if p_amount <> round(p_amount, 2) then raise exception 'Valor com mais de duas casas decimais' using errcode = 'P0001'; end if;
  if p_paid_on is null or p_paid_on > public.app_today() then raise exception 'A data do pagamento não pode estar no futuro' using errcode = 'P0001'; end if;

  select * into i from public.installments where id = p_installment_id for update;
  if i.id is null then raise exception 'Parcela não encontrada' using errcode = 'P0001'; end if;
  select * into s from public.sales where id = i.sale_id;
  if i.cancelled or s.status = 'cancelled' then raise exception 'Parcela de venda cancelada' using errcode = 'P0001'; end if;
  if p_paid_on < s.sale_date then raise exception 'A data do pagamento é anterior à data da venda' using errcode = 'P0001'; end if;

  select coalesce(sum(amount), 0) into v_pending from public.payments where installment_id = i.id and status = 'pending_confirmation';
  v_available := i.amount - i.paid_amount - v_pending;
  if v_available <= 0 then raise exception 'Esta parcela já está quitada ou com pagamentos aguardando confirmação' using errcode = 'P0001'; end if;
  if p_amount > v_available then
    raise exception 'Valor (%) superior ao saldo disponível da parcela (%)', public.fmt_brl(p_amount), public.fmt_brl(v_available) using errcode = 'P0001';
  end if;

  insert into public.payments (installment_id, sale_id, customer_id, amount, paid_on, method, notes, status, idempotency_key, created_by)
  values (i.id, i.sale_id, i.customer_id, p_amount, p_paid_on, p_method, nullif(trim(p_notes), ''), 'pending_confirmation', p_idempotency_key, auth.uid())
  returning id into v_id;

  if p_confirm then
    perform public._apply_payment_confirmation(v_id);
  else
    perform public.log_activity('payment_pending', 'payments', v_id, i.customer_id,
      'Pagamento de ' || public.fmt_brl(p_amount) || ' via ' || public.method_label(p_method) || ' registrado — aguardando confirmação',
      null, jsonb_build_object('amount', p_amount, 'method', p_method, 'paid_on', p_paid_on));
  end if;

  update public.customers set last_contact_at = now() where id = i.customer_id;
  return v_id;
end $$;

create or replace function public.confirm_payment(p_payment_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_active();
  perform public._apply_payment_confirmation(p_payment_id);
end $$;

create or replace function public.reject_payment(p_payment_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare p public.payments%rowtype;
begin
  perform public.assert_active();
  if coalesce(length(trim(p_reason)), 0) < 3 then raise exception 'Informe o motivo' using errcode = 'P0001'; end if;
  select * into p from public.payments where id = p_payment_id for update;
  if p.id is null then raise exception 'Pagamento não encontrado' using errcode = 'P0001'; end if;
  if p.status <> 'pending_confirmation' then raise exception 'Apenas pagamentos aguardando confirmação podem ser rejeitados' using errcode = 'P0001'; end if;
  if not public.is_owner() and p.created_by is distinct from auth.uid() then
    raise exception 'Apenas o proprietário ou quem registrou pode rejeitar este pagamento' using errcode = '42501';
  end if;
  update public.payments set status = 'rejected', rejected_by = auth.uid(), rejected_at = now(), status_reason = p_reason where id = p.id;
  perform public.log_activity('payment_rejected', 'payments', p.id, p.customer_id,
    'Pagamento de ' || public.fmt_brl(p.amount) || ' não confirmado — ' || p_reason,
    jsonb_build_object('status', p.status), jsonb_build_object('status', 'rejected'));
end $$;

create or replace function public.reverse_payment(p_payment_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare p public.payments%rowtype; v_code bigint;
begin
  perform public.assert_owner();
  if coalesce(length(trim(p_reason)), 0) < 5 then raise exception 'Informe a justificativa do estorno (mínimo 5 caracteres)' using errcode = 'P0001'; end if;
  select * into p from public.payments where id = p_payment_id for update;
  if p.id is null then raise exception 'Pagamento não encontrado' using errcode = 'P0001'; end if;
  if p.status <> 'confirmed' then raise exception 'Apenas pagamentos confirmados podem ser estornados' using errcode = 'P0001'; end if;
  perform 1 from public.installments where id = p.installment_id for update;

  update public.installments set paid_amount = paid_amount - p.amount, paid_at = null where id = p.installment_id;
  update public.payments set status = 'reversed', reversed_by = auth.uid(), reversed_at = now(), status_reason = p_reason where id = p.id;
  select code into v_code from public.sales where id = p.sale_id;
  insert into public.cash_movements (kind, payment_id, amount, method, occurred_on, description, created_by)
  values ('reversal', p.id, -p.amount, p.method, public.app_today(), 'Estorno venda #' || v_code || ' — ' || p_reason, auth.uid());
  perform public.log_activity('payment_reversed', 'payments', p.id, p.customer_id,
    'Estorno de ' || public.fmt_brl(p.amount) || ' (venda #' || v_code || ') — ' || p_reason,
    jsonb_build_object('status', 'confirmed'), jsonb_build_object('status', 'reversed'));
  perform public._refresh_sale_status(p.sale_id);
end $$;

-- -----------------------------------------------------------------------------
-- RPC: Adiamentos e promessas
-- -----------------------------------------------------------------------------
create or replace function public.postpone_installment(
  p_installment_id uuid, p_new_date date, p_reason text, p_notes text,
  p_expected_channel public.payment_method, p_needs_visit boolean
) returns uuid
language plpgsql security definer set search_path = public as $$
declare i public.installments%rowtype; v_id uuid; v_code bigint;
begin
  perform public.assert_active();
  if coalesce(length(trim(p_reason)), 0) < 3 then raise exception 'Informe o motivo do adiamento' using errcode = 'P0001'; end if;
  select * into i from public.installments where id = p_installment_id for update;
  if i.id is null then raise exception 'Parcela não encontrada' using errcode = 'P0001'; end if;
  if i.cancelled then raise exception 'Parcela cancelada' using errcode = 'P0001'; end if;
  if i.paid_amount >= i.amount then raise exception 'Parcela já quitada' using errcode = 'P0001'; end if;
  if p_new_date is null or p_new_date < public.app_today() then raise exception 'A nova data deve ser hoje ou uma data futura' using errcode = 'P0001'; end if;
  if p_new_date = i.collection_date then raise exception 'A nova data é igual à data de cobrança atual' using errcode = 'P0001'; end if;

  insert into public.payment_postponements (installment_id, customer_id, previous_date, new_date, reason, notes, expected_channel, needs_visit, created_by)
  values (i.id, i.customer_id, i.collection_date, p_new_date, trim(p_reason), nullif(trim(p_notes), ''), p_expected_channel, coalesce(p_needs_visit, false), auth.uid())
  returning id into v_id;

  update public.installments set collection_date = p_new_date, postponed_count = postponed_count + 1,
    needs_visit = coalesce(p_needs_visit, false), expected_channel = p_expected_channel
  where id = i.id;

  select code into v_code from public.sales where id = i.sale_id;
  perform public.log_activity('postponement', 'installments', i.id, i.customer_id,
    'Cobrança adiada de ' || public.fmt_date(i.collection_date) || ' para ' || public.fmt_date(p_new_date)
      || ' (venda #' || v_code || case when i.number = 0 then ', entrada' else ', parcela ' || i.number end || ') — ' || trim(p_reason)
      || case when p_needs_visit then ' · requer visita presencial' else '' end,
    jsonb_build_object('collection_date', i.collection_date), jsonb_build_object('collection_date', p_new_date, 'reason', p_reason));
  update public.customers set last_contact_at = now() where id = i.customer_id;
  return v_id;
end $$;

create or replace function public.create_promise(
  p_customer_id uuid, p_installment_id uuid, p_amount numeric, p_due_date date,
  p_expected_method public.payment_method, p_notes text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_balance numeric;
begin
  perform public.assert_active();
  if p_amount is null or p_amount <= 0 then raise exception 'Informe o valor prometido' using errcode = 'P0001'; end if;
  if p_due_date is null or p_due_date < public.app_today() then raise exception 'A data combinada deve ser hoje ou futura' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.customers where id = p_customer_id) then raise exception 'Cliente não encontrado' using errcode = 'P0001'; end if;
  if p_installment_id is not null and not exists (select 1 from public.installments where id = p_installment_id and customer_id = p_customer_id) then
    raise exception 'Parcela não pertence ao cliente' using errcode = 'P0001';
  end if;
  select coalesce(sum(i.amount - i.paid_amount), 0) into v_balance from public.installments i join public.sales s on s.id = i.sale_id
    where i.customer_id = p_customer_id and not i.cancelled and s.status <> 'cancelled';
  if p_amount > v_balance then raise exception 'Valor prometido maior que o saldo devedor do cliente (%)', public.fmt_brl(v_balance) using errcode = 'P0001'; end if;

  insert into public.payment_promises (customer_id, installment_id, amount, due_date, expected_method, notes, created_by)
  values (p_customer_id, p_installment_id, p_amount, p_due_date, p_expected_method, nullif(trim(p_notes), ''), auth.uid())
  returning id into v_id;
  perform public.log_activity('promise', 'payment_promises', v_id, p_customer_id,
    'Promessa de pagamento de ' || public.fmt_brl(p_amount) || ' para ' || public.fmt_date(p_due_date)
      || coalesce(' via ' || public.method_label(p_expected_method), ''), null,
    jsonb_build_object('amount', p_amount, 'due_date', p_due_date));
  update public.customers set last_contact_at = now() where id = p_customer_id;
  return v_id;
end $$;

create or replace function public.resolve_promise(p_promise_id uuid, p_status public.promise_status, p_notes text) returns void
language plpgsql security definer set search_path = public as $$
declare pp public.payment_promises%rowtype;
begin
  perform public.assert_active();
  if p_status not in ('kept', 'broken', 'cancelled') then raise exception 'Situação inválida' using errcode = 'P0001'; end if;
  select * into pp from public.payment_promises where id = p_promise_id for update;
  if pp.id is null then raise exception 'Promessa não encontrada' using errcode = 'P0001'; end if;
  if pp.status <> 'pending' then raise exception 'Promessa já resolvida' using errcode = 'P0001'; end if;
  update public.payment_promises set status = p_status, resolved_at = now(), resolved_by = auth.uid(),
    notes = coalesce(nullif(trim(p_notes), ''), notes) where id = pp.id;
  perform public.log_activity('promise_' || p_status::text, 'payment_promises', pp.id, pp.customer_id,
    'Promessa de ' || public.fmt_brl(pp.amount) || ' (' || public.fmt_date(pp.due_date) || ') marcada como '
      || case p_status when 'kept' then 'cumprida' when 'broken' then 'não cumprida' else 'cancelada' end
      || coalesce(' — ' || nullif(trim(p_notes), ''), ''),
    jsonb_build_object('status', pp.status), jsonb_build_object('status', p_status));
end $$;

-- -----------------------------------------------------------------------------
-- RPC: Caixa
-- -----------------------------------------------------------------------------
create or replace function public.cash_adjustment(p_amount numeric, p_method public.payment_method, p_date date, p_justification text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.assert_owner();
  if p_amount is null or p_amount = 0 then raise exception 'Informe um valor diferente de zero' using errcode = 'P0001'; end if;
  if coalesce(length(trim(p_justification)), 0) < 5 then raise exception 'Justificativa obrigatória (mínimo 5 caracteres)' using errcode = 'P0001'; end if;
  if p_date is null or p_date > public.app_today() then raise exception 'Data inválida' using errcode = 'P0001'; end if;
  insert into public.cash_movements (kind, amount, method, occurred_on, description, created_by)
  values ('adjustment', round(p_amount, 2), p_method, p_date, trim(p_justification), auth.uid()) returning id into v_id;
  perform public.log_activity('cash_adjustment', 'cash_movements', v_id, null,
    'Ajuste de caixa de ' || public.fmt_brl(p_amount) || ' (' || public.method_label(p_method) || ', ' || public.fmt_date(p_date) || ') — ' || trim(p_justification),
    null, jsonb_build_object('amount', p_amount, 'method', p_method, 'date', p_date));
  return v_id;
end $$;

create or replace function public.cash_day_summary(p_date date) returns jsonb
language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'date', p_date,
    'total', coalesce(sum(amount), 0),
    'pix', coalesce(sum(amount) filter (where method = 'pix'), 0),
    'cash', coalesce(sum(amount) filter (where method = 'cash'), 0),
    'transfer', coalesce(sum(amount) filter (where method = 'transfer'), 0),
    'other', coalesce(sum(amount) filter (where method = 'other'), 0),
    'payments_count', count(*) filter (where kind = 'payment'),
    'payments_total', coalesce(sum(amount) filter (where kind = 'payment'), 0),
    'reversals_total', coalesce(sum(amount) filter (where kind = 'reversal'), 0),
    'adjustments_total', coalesce(sum(amount) filter (where kind = 'adjustment'), 0),
    'by_user', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', u.created_by, 'name', pr.full_name, 'total', u.total, 'count', u.cnt) order by u.total desc)
      from (select created_by, sum(amount) as total, count(*) filter (where kind = 'payment') as cnt
            from public.cash_movements where occurred_on = p_date group by created_by) u
      left join public.profiles pr on pr.id = u.created_by
    ), '[]'::jsonb),
    'closing', (select to_jsonb(cc) from public.cash_closings cc where cc.closing_date = p_date)
  )
  from public.cash_movements where occurred_on = p_date
$$;

create or replace function public.close_cash_day(p_date date, p_counted_cash numeric, p_notes text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; t record;
begin
  perform public.assert_owner();
  if p_date is null or p_date > public.app_today() then raise exception 'Data inválida' using errcode = 'P0001'; end if;
  if exists (select 1 from public.cash_closings where closing_date = p_date) then raise exception 'Este dia já foi conferido' using errcode = 'P0001'; end if;
  select coalesce(sum(amount), 0) as total,
         coalesce(sum(amount) filter (where method = 'pix'), 0) as pix,
         coalesce(sum(amount) filter (where method = 'cash'), 0) as cash,
         coalesce(sum(amount) filter (where method = 'transfer'), 0) as transfer,
         coalesce(sum(amount) filter (where method = 'other'), 0) as other
    into t from public.cash_movements where occurred_on = p_date;
  insert into public.cash_closings (closing_date, expected_total, expected_pix, expected_cash, expected_transfer, expected_other,
                                    counted_cash, divergence, notes, closed_by)
  values (p_date, t.total, t.pix, t.cash, t.transfer, t.other, p_counted_cash,
          case when p_counted_cash is null then 0 else p_counted_cash - t.cash end, nullif(trim(p_notes), ''), auth.uid())
  returning id into v_id;
  perform public.log_activity('cash_closing', 'cash_closings', v_id, null,
    'Conferência do caixa de ' || public.fmt_date(p_date) || ': esperado ' || public.fmt_brl(t.total)
      || case when p_counted_cash is not null and p_counted_cash <> t.cash then ' · divergência em dinheiro de ' || public.fmt_brl(p_counted_cash - t.cash) else '' end);
  return v_id;
end $$;

-- -----------------------------------------------------------------------------
-- RPC: Visitas
-- -----------------------------------------------------------------------------
create or replace function public.set_visit_customer_status(p_visit_customer_id uuid, p_status public.visit_customer_status, p_notes text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_active();
  update public.visit_customers set status = p_status, notes = coalesce(nullif(trim(p_notes), ''), notes), updated_by = auth.uid()
  where id = p_visit_customer_id;
  if not found then raise exception 'Registro de visita não encontrado' using errcode = 'P0001'; end if;
end $$;

-- Clientes que precisam de atendimento presencial em uma cidade
create or replace function public.customers_to_visit(p_city_id uuid) returns table (
  customer_id uuid, full_name text, phone text, neighborhood text, address text, reference text,
  balance numeric, overdue_amount numeric, next_collection_date date, needs_visit boolean,
  has_postponement boolean, has_broken_promise boolean, reason text
)
language sql stable security invoker set search_path = public as $$
  select c.id, c.full_name, coalesce(c.whatsapp, c.phone), c.neighborhood, c.address, c.reference,
    c.balance, c.overdue_amount, c.next_collection_date,
    exists (select 1 from public.installments i where i.customer_id = c.id and i.needs_visit and i.paid_amount < i.amount and not i.cancelled),
    c.financial_status = 'postponed',
    exists (select 1 from public.v_promises p where p.customer_id = c.id and p.effective_status = 'broken'),
    concat_ws(' · ',
      case when c.overdue_amount > 0 then 'Em atraso: ' || public.fmt_brl(c.overdue_amount) end,
      case when c.financial_status = 'postponed' then 'Pagamento adiado' end,
      case when exists (select 1 from public.installments i where i.customer_id = c.id and i.needs_visit and i.paid_amount < i.amount and not i.cancelled) then 'Pediu visita presencial' end,
      case when exists (select 1 from public.v_promises p where p.customer_id = c.id and p.effective_status = 'broken') then 'Promessa não cumprida' end,
      case when c.financial_status = 'pending' then 'Pendência para conferir' end,
      case when c.overdue_amount = 0 and c.financial_status in ('up_to_date') and c.next_collection_date <= public.app_today() + 7 then 'Cobrança próxima' end
    )
  from public.v_customers c
  where c.city_id = p_city_id and c.archived_at is null and c.balance > 0
    and (c.overdue_amount > 0 or c.financial_status in ('postponed', 'pending')
         or c.next_collection_date <= public.app_today() + 7
         or exists (select 1 from public.installments i where i.customer_id = c.id and i.needs_visit and i.paid_amount < i.amount and not i.cancelled))
  order by c.overdue_amount desc, c.next_collection_date nulls last
$$;

-- -----------------------------------------------------------------------------
-- Dashboard, relatórios, notificações
-- -----------------------------------------------------------------------------
create or replace function public.dashboard_summary() returns jsonb
language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'today', public.app_today(),
    'total_receivable', (select coalesce(sum(remaining), 0) from public.v_installments where status not in ('paid', 'cancelled')),
    'overdue_amount', (select coalesce(sum(remaining), 0) from public.v_installments where status = 'overdue'),
    'overdue_count', (select count(*) from public.v_installments where status = 'overdue'),
    'overdue_customers', (select count(distinct customer_id) from public.v_installments where status = 'overdue'),
    'received_today', (select coalesce(sum(amount), 0) from public.payments where status = 'confirmed' and paid_on = public.app_today()),
    'received_today_count', (select count(*) from public.payments where status = 'confirmed' and paid_on = public.app_today()),
    'due_today_amount', (select coalesce(sum(remaining), 0) from public.v_installments where status = 'due_today'),
    'due_today_count', (select count(*) from public.v_installments where status = 'due_today'),
    'active_customers', (select count(*) from public.customers where archived_at is null),
    'customers_with_balance', (select count(distinct customer_id) from public.v_installments where status not in ('paid', 'cancelled')),
    'pending_confirmations', (select count(*) from public.payments where status = 'pending_confirmation'),
    'broken_promises', (select count(*) from public.v_promises where effective_status = 'broken'),
    'sold_month', (select coalesce(sum(total), 0) from public.sales where status <> 'cancelled' and date_trunc('month', sale_date) = date_trunc('month', public.app_today())),
    'received_month', (select coalesce(sum(amount), 0) from public.payments where status = 'confirmed' and date_trunc('month', paid_on) = date_trunc('month', public.app_today()))
  )
$$;

create or replace function public.monthly_series(p_months int default 6) returns table (month date, sold numeric, received numeric, due numeric)
language sql stable security invoker set search_path = public as $$
  with months as (
    select (date_trunc('month', public.app_today()) - make_interval(months => g))::date as m
    from generate_series(0, greatest(least(p_months, 24), 1) - 1) g
  )
  select m,
    (select coalesce(sum(total), 0) from public.sales where status <> 'cancelled' and date_trunc('month', sale_date) = m),
    (select coalesce(sum(amount), 0) from public.payments where status = 'confirmed' and date_trunc('month', paid_on) = m),
    (select coalesce(sum(i.amount), 0) from public.installments i join public.sales s on s.id = i.sale_id
       where not i.cancelled and s.status <> 'cancelled' and date_trunc('month', i.original_due_date) = m)
  from months order by m
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
      from public.payments where status = 'confirmed' and paid_on between p_from and p_to),
    'total_pending', (select coalesce(sum(remaining), 0) from public.v_installments where status not in ('paid', 'cancelled')),
    'total_overdue', (select coalesce(sum(remaining), 0) from public.v_installments where status = 'overdue'),
    'delinquent_customers', (select count(distinct customer_id) from public.v_installments where status = 'overdue')
  )
$$;

create or replace function public.report_by_city(p_from date, p_to date) returns table (
  city_id uuid, city_name text, state text, total_sold numeric, total_received numeric,
  total_pending numeric, total_overdue numeric, customers_count bigint, overdue_customers bigint
)
language sql stable security invoker set search_path = public as $$
  select ci.id, ci.name, ci.state::text,
    (select coalesce(sum(s.total), 0) from public.sales s where s.city_id = ci.id and s.status <> 'cancelled' and s.sale_date between p_from and p_to),
    (select coalesce(sum(p.amount), 0) from public.payments p join public.customers c on c.id = p.customer_id
       where c.city_id = ci.id and p.status = 'confirmed' and p.paid_on between p_from and p_to),
    (select coalesce(sum(v.remaining), 0) from public.v_installments v where v.city_id = ci.id and v.status not in ('paid', 'cancelled')),
    (select coalesce(sum(v.remaining), 0) from public.v_installments v where v.city_id = ci.id and v.status = 'overdue'),
    (select count(*) from public.customers c where c.city_id = ci.id and c.archived_at is null),
    (select count(distinct v.customer_id) from public.v_installments v where v.city_id = ci.id and v.status = 'overdue')
  from public.cities ci
  where not ci.archived
  order by 6 desc, 2
$$;

create or replace function public.delinquency_aging() returns table (bucket text, sort_order int, amount numeric, installments_count bigint, customers_count bigint)
language sql stable security invoker set search_path = public as $$
  with b(bucket, sort_order, lo, hi) as (values ('Até 7 dias', 1, 1, 7), ('8 a 15 dias', 2, 8, 15), ('16 a 30 dias', 3, 16, 30), ('Acima de 30 dias', 4, 31, 100000))
  select b.bucket, b.sort_order,
    coalesce(sum(v.remaining), 0), count(v.id), count(distinct v.customer_id)
  from b left join public.v_installments v on v.status = 'overdue' and greatest(v.days_overdue, 1) between b.lo and b.hi
  group by b.bucket, b.sort_order order by b.sort_order
$$;

create or replace function public.get_notifications() returns table (
  key text, kind text, severity text, title text, body text, link text, customer_id uuid, ref_date date, is_read boolean
)
language sql stable security invoker set search_path = public as $$
  with cfg as (
    select coalesce((value->>'due_soon_days')::int, 3) as due_soon, coalesce((value->>'visit_soon_days')::int, 3) as visit_soon
    from public.app_settings where key = 'billing'
  ),
  n as (
    select 'due_today:' || v.id || ':' || v.collection_date as key, 'due_today' as kind, 'warning' as severity,
      'Cobrar hoje: ' || v.customer_name as title,
      public.fmt_brl(v.remaining) || ' · ' || coalesce(v.city_name, 'Sem cidade') || ' · venda #' || v.sale_code as body,
      '/clientes/' || v.customer_id as link, v.customer_id, v.collection_date as ref_date
    from public.v_installments v where v.status = 'due_today'
    union all
    select 'overdue:' || v.id || ':' || v.collection_date, 'overdue', 'danger',
      'Parcela atrasada: ' || v.customer_name,
      public.fmt_brl(v.remaining) || ' · ' || v.days_overdue || ' dia(s) de atraso',
      '/clientes/' || v.customer_id, v.customer_id, v.collection_date
    from public.v_installments v where v.status = 'overdue'
    union all
    select 'due_soon:' || v.id || ':' || v.collection_date, 'due_soon', 'info',
      'Vence em breve: ' || v.customer_name,
      public.fmt_brl(v.remaining) || ' em ' || public.fmt_date(v.collection_date),
      '/clientes/' || v.customer_id, v.customer_id, v.collection_date
    from public.v_installments v, cfg
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
    select 'needs_visit:' || v.id || ':' || v.collection_date, 'needs_return', 'info',
      'Precisa de retorno: ' || v.customer_name,
      'Visita presencial solicitada · ' || coalesce(v.city_name, 'Sem cidade'),
      '/clientes/' || v.customer_id, v.customer_id, v.collection_date
    from public.v_installments v
    where v.needs_visit and v.status not in ('paid', 'cancelled') and v.collection_date <= public.app_today() + 3
  )
  select n.key, n.kind, n.severity, n.title, n.body, n.link, n.customer_id, n.ref_date,
    exists (select 1 from public.notification_reads r where r.user_id = auth.uid() and r.notification_key = n.key)
  from n
  order by case n.severity when 'danger' then 1 when 'warning' then 2 else 3 end, n.ref_date
  limit 200
$$;

-- Busca global
create or replace function public.global_search(p_query text) returns table (kind text, id uuid, title text, subtitle text, link text)
language sql stable security invoker set search_path = public as $$
  with q as (select '%' || lower(trim(p_query)) || '%' as like_q, regexp_replace(p_query, '\D', '', 'g') as digits)
  (select 'customer', c.id, c.full_name, concat_ws(' · ', c.city_name, c.phone), '/clientes/' || c.id
   from public.v_customers c, q
   where length(trim(p_query)) >= 2 and (lower(c.full_name) like q.like_q
      or (length(q.digits) >= 3 and (regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') like '%' || q.digits || '%'
                                  or regexp_replace(coalesce(c.whatsapp, ''), '\D', '', 'g') like '%' || q.digits || '%')))
   order by c.archived_at nulls first, c.full_name limit 8)
  union all
  (select 'sale', s.id, 'Venda #' || s.code || ' — ' || s.customer_name, public.fmt_brl(s.total) || ' · ' || public.fmt_date(s.sale_date), '/vendas/' || s.id
   from public.v_sales s, q
   where length(trim(p_query)) >= 1 and (s.code::text = trim(replace(p_query, '#', '')) or lower(s.customer_name) like q.like_q)
   order by s.sale_date desc limit 5)
  union all
  (select 'city', ci.id, ci.name || '/' || ci.state, 'Cidade', '/cidades/' || ci.id
   from public.cities ci, q where length(trim(p_query)) >= 2 and lower(ci.name) like q.like_q limit 4)
  union all
  (select 'product', pr.id, pr.name, coalesce(pr.category, 'Produto') || ' · ' || public.fmt_brl(pr.price), '/produtos?editar=' || pr.id
   from public.products pr, q where length(trim(p_query)) >= 2 and lower(pr.name) like q.like_q limit 4)
$$;
