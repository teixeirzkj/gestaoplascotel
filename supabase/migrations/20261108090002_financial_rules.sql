-- =============================================================================
-- PLASCOTEL — Correções de regras financeiras
--   1. days_overdue nunca negativo (cobrança antecipada conta desde a data de cobrança)
--   2. Promessas: alocação FIFO do valor de cada pagamento (promise_allocations),
--      reabertura no estorno e cancelamento junto com a venda
--   3. create_promise com parcela: limite pelo saldo da parcela
--   4. Caixa por usuário: movimento atribuído a quem recebeu (payments.created_by)
--   5. Dias de caixa conferidos não recebem novos lançamentos
--   6. cancel_sale x register_payment: ordem de lock parcela -> venda
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. v_installments.days_overdue
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
  -- Conta a partir do vencimento original; se a cobrança foi antecipada e venceu, desde a data de cobrança.
  case when i.paid_amount < i.amount and not i.cancelled and s.status <> 'cancelled' and i.collection_date < public.app_today()
       then public.app_today() - least(i.original_due_date, i.collection_date) else 0 end as days_overdue,
  (i.paid_amount > 0 and i.paid_amount < i.amount) as is_partial,
  c.archived_at is not null as customer_archived
from public.installments i
join public.sales s on s.id = i.sale_id
join public.customers c on c.id = i.customer_id
left join public.cities ci on ci.id = c.city_id;

-- -----------------------------------------------------------------------------
-- 2. Alocação de pagamentos em promessas
-- Escrita somente pelas funções security definer; leitura para usuários ativos.
-- -----------------------------------------------------------------------------
create table public.promise_allocations (
  promise_id uuid not null references public.payment_promises(id),
  payment_id uuid not null references public.payments(id),
  amount numeric(12,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  primary key (promise_id, payment_id)
);
create index promise_allocations_payment_idx on public.promise_allocations (payment_id);
alter table public.promise_allocations enable row level security;
create policy promise_allocations_select on public.promise_allocations for select to authenticated
  using ((select public.is_active_user()));
revoke all on public.promise_allocations from anon, authenticated;
grant select on public.promise_allocations to authenticated;

-- -----------------------------------------------------------------------------
-- Confirmação de pagamento
-- -----------------------------------------------------------------------------
create or replace function public._apply_payment_confirmation(p_payment uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  p public.payments%rowtype; i public.installments%rowtype; pp public.payment_promises%rowtype;
  v_code bigint; v_mov date; v_left numeric(12,2); v_need numeric(12,2); v_take numeric(12,2);
begin
  select * into p from public.payments where id = p_payment for update;
  if p.id is null then raise exception 'Pagamento não encontrado' using errcode = 'P0001'; end if;
  if p.status <> 'pending_confirmation' then
    raise exception 'Este pagamento não está aguardando confirmação' using errcode = 'P0001';
  end if;
  select * into i from public.installments where id = p.installment_id for update;
  if i.cancelled then
    raise exception 'Parcela de venda cancelada — rejeite este pagamento' using errcode = 'P0001';
  end if;
  if p.amount > (i.amount - i.paid_amount) then
    raise exception 'Valor (%) superior ao saldo da parcela (%)', public.fmt_brl(p.amount), public.fmt_brl(i.amount - i.paid_amount) using errcode = 'P0001';
  end if;

  -- Caixa: dia já conferido não recebe lançamento; o movimento entra no caixa de hoje.
  perform pg_advisory_xact_lock(hashtext('cash:' || p.paid_on));
  v_mov := case when exists (select 1 from public.cash_closings where closing_date = p.paid_on) then public.app_today() else p.paid_on end;
  if v_mov <> p.paid_on then
    perform pg_advisory_xact_lock(hashtext('cash:' || v_mov));
    if exists (select 1 from public.cash_closings where closing_date = v_mov) then
      raise exception 'O caixa de hoje já foi conferido' using errcode = 'P0001';
    end if;
  end if;

  update public.installments set
    paid_amount = paid_amount + p.amount,
    paid_at = case when paid_amount + p.amount >= amount then p.paid_on else null end,
    needs_visit = case when paid_amount + p.amount >= amount then false else needs_visit end
  where id = i.id;

  update public.payments set status = 'confirmed', confirmed_by = auth.uid(), confirmed_at = now() where id = p.id;

  select code into v_code from public.sales where id = p.sale_id;
  -- created_by = quem recebeu (registrou); quem confirmou fica em payments.confirmed_by.
  insert into public.cash_movements (kind, payment_id, amount, method, occurred_on, description, created_by)
  values ('payment', p.id, p.amount, p.method, v_mov,
          'Recebimento venda #' || v_code || case when i.number = 0 then ' (entrada)' else ' parcela ' || i.number end
            || case when v_mov <> p.paid_on then ' (pago em ' || public.fmt_date(p.paid_on) || ')' else '' end,
          coalesce(p.created_by, auth.uid()));

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

  -- Promessas: o valor DESTE pagamento é alocado (FIFO) às promessas pendentes do cliente.
  -- Ignora promessas feitas depois do registro do pagamento e parcelas criadas depois da
  -- promessa (ex.: entrada de uma venda nova não cumpre promessa de dívida antiga).
  v_left := p.amount;
  for pp in
    select pr.* from public.payment_promises pr
    where pr.customer_id = p.customer_id and pr.status = 'pending'
      and (pr.installment_id is null or pr.installment_id = i.id)
      and pr.created_at <= p.created_at
      and i.created_at <= pr.created_at
    order by (pr.installment_id is null), pr.due_date, pr.created_at
    for update of pr
  loop
    exit when v_left <= 0;
    select pp.amount - coalesce(sum(a.amount), 0) into v_need from public.promise_allocations a where a.promise_id = pp.id;
    continue when v_need <= 0;
    v_take := least(v_left, v_need);
    insert into public.promise_allocations (promise_id, payment_id, amount) values (pp.id, p.id, v_take);
    v_left := v_left - v_take;
    if v_take >= v_need then
      update public.payment_promises set status = 'kept', resolved_at = now(), resolved_by = auth.uid() where id = pp.id;
      perform public.log_activity('promise_kept', 'payment_promises', pp.id, pp.customer_id,
        'Promessa de ' || public.fmt_brl(pp.amount) || ' (' || public.fmt_date(pp.due_date) || ') cumprida automaticamente pelo pagamento confirmado',
        jsonb_build_object('status', 'pending'), jsonb_build_object('status', 'kept', 'payment_id', p.id));
    end if;
  end loop;

  perform public._refresh_sale_status(p.sale_id);
end $$;
revoke execute on function public._apply_payment_confirmation(uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Estorno: reabre promessas cumpridas por este pagamento; não lança em dia conferido
-- -----------------------------------------------------------------------------
create or replace function public.reverse_payment(p_payment_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare p public.payments%rowtype; v_code bigint; r record;
begin
  perform public.assert_owner();
  if coalesce(length(trim(p_reason)), 0) < 5 then raise exception 'Informe a justificativa do estorno (mínimo 5 caracteres)' using errcode = 'P0001'; end if;
  select * into p from public.payments where id = p_payment_id for update;
  if p.id is null then raise exception 'Pagamento não encontrado' using errcode = 'P0001'; end if;
  if p.status <> 'confirmed' then raise exception 'Apenas pagamentos confirmados podem ser estornados' using errcode = 'P0001'; end if;
  perform 1 from public.installments where id = p.installment_id for update;

  perform pg_advisory_xact_lock(hashtext('cash:' || public.app_today()));
  if exists (select 1 from public.cash_closings where closing_date = public.app_today()) then
    raise exception 'O caixa de hoje já foi conferido; o estorno não pode ser lançado' using errcode = 'P0001';
  end if;

  update public.installments set paid_amount = paid_amount - p.amount, paid_at = null where id = p.installment_id;
  update public.payments set status = 'reversed', reversed_by = auth.uid(), reversed_at = now(), status_reason = p_reason where id = p.id;
  select code into v_code from public.sales where id = p.sale_id;
  insert into public.cash_movements (kind, payment_id, amount, method, occurred_on, description, created_by)
  values ('reversal', p.id, -p.amount, p.method, public.app_today(), 'Estorno venda #' || v_code || ' — ' || p_reason, auth.uid());
  perform public.log_activity('payment_reversed', 'payments', p.id, p.customer_id,
    'Estorno de ' || public.fmt_brl(p.amount) || ' (venda #' || v_code || ') — ' || p_reason,
    jsonb_build_object('status', 'confirmed'), jsonb_build_object('status', 'reversed'));

  -- Promessas cumpridas automaticamente com este pagamento voltam a pendentes
  -- (as marcadas à mão via resolve_promise não têm alocação e não são afetadas).
  for r in
    update public.payment_promises pr set status = 'pending', resolved_at = null, resolved_by = null
    where pr.status = 'kept' and pr.id in (select a.promise_id from public.promise_allocations a where a.payment_id = p.id)
    returning pr.id, pr.customer_id, pr.amount, pr.due_date
  loop
    perform public.log_activity('promise', 'payment_promises', r.id, r.customer_id,
      'Promessa de ' || public.fmt_brl(r.amount) || ' (' || public.fmt_date(r.due_date) || ') reaberta pelo estorno do pagamento',
      jsonb_build_object('status', 'kept'), jsonb_build_object('status', 'pending'));
  end loop;
  delete from public.promise_allocations where payment_id = p.id;

  perform public._refresh_sale_status(p.sale_id);
end $$;

-- -----------------------------------------------------------------------------
-- Cancelamento de venda: lock parcela -> venda; promessas da dívida cancelada
-- -----------------------------------------------------------------------------
create or replace function public.cancel_sale(p_sale_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare s public.sales%rowtype; v_n int;
begin
  perform public.assert_owner();
  if coalesce(length(trim(p_reason)), 0) < 5 then raise exception 'Informe o motivo do cancelamento (mínimo 5 caracteres)' using errcode = 'P0001'; end if;
  -- Mesma ordem de register_payment (parcela -> venda): um registro em andamento termina
  -- antes e o pagamento dele é enxergado pela checagem abaixo.
  perform 1 from public.installments where sale_id = p_sale_id order by id for update;
  select * into s from public.sales where id = p_sale_id for update;
  if s.id is null then raise exception 'Venda não encontrada' using errcode = 'P0001'; end if;
  if s.status = 'cancelled' then raise exception 'Venda já cancelada' using errcode = 'P0001'; end if;
  if exists (select 1 from public.payments where sale_id = p_sale_id and status in ('confirmed', 'pending_confirmation')) then
    raise exception 'Existem pagamentos ativos nesta venda. Estorne/rejeite-os antes de cancelar.' using errcode = 'P0001';
  end if;
  update public.sales set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(), cancel_reason = p_reason where id = p_sale_id;
  update public.installments set cancelled = true where sale_id = p_sale_id;

  -- Promessas ligadas às parcelas desta venda, ou gerais quando o cliente não tem mais saldo.
  with c as (
    update public.payment_promises pp set status = 'cancelled', resolved_at = now(), resolved_by = auth.uid()
    where pp.status = 'pending'
      and (pp.installment_id in (select id from public.installments where sale_id = p_sale_id)
           or (pp.installment_id is null and pp.customer_id = s.customer_id
               and not exists (select 1 from public.installments i join public.sales sx on sx.id = i.sale_id
                               where i.customer_id = s.customer_id and not i.cancelled and sx.status <> 'cancelled'
                                 and i.paid_amount < i.amount)))
    returning pp.id
  )
  select count(*) into v_n from c;

  perform public.log_activity('sale_cancelled', 'sales', p_sale_id, s.customer_id,
    'Venda #' || s.code || ' cancelada — ' || p_reason, jsonb_build_object('status', s.status), jsonb_build_object('status', 'cancelled'));
  if v_n > 0 then
    perform public.log_activity('promise_cancelled', 'sales', p_sale_id, s.customer_id,
      v_n || ' promessa(s) cancelada(s) junto com a venda #' || s.code);
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Promessa: com parcela, limite pelo saldo da parcela
-- -----------------------------------------------------------------------------
create or replace function public.create_promise(
  p_customer_id uuid, p_installment_id uuid, p_amount numeric, p_due_date date,
  p_expected_method public.payment_method, p_notes text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_balance numeric;
begin
  perform public.assert_active();
  if p_amount is null or p_amount <= 0 then raise exception 'Informe o valor prometido' using errcode = 'P0001'; end if;
  if p_amount <> round(p_amount, 2) then raise exception 'Valor com mais de duas casas decimais' using errcode = 'P0001'; end if;
  if p_due_date is null or p_due_date < public.app_today() then raise exception 'A data combinada deve ser hoje ou futura' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.customers where id = p_customer_id) then raise exception 'Cliente não encontrado' using errcode = 'P0001'; end if;

  if p_installment_id is not null then
    select i.amount - i.paid_amount into v_balance
      from public.installments i join public.sales s on s.id = i.sale_id
     where i.id = p_installment_id and i.customer_id = p_customer_id
       and not i.cancelled and s.status <> 'cancelled';
    if not found then raise exception 'Parcela não pertence ao cliente' using errcode = 'P0001'; end if;
    if v_balance <= 0 then raise exception 'Esta parcela já está quitada' using errcode = 'P0001'; end if;
    if p_amount > v_balance then
      raise exception 'Valor prometido maior que o saldo da parcela (%)', public.fmt_brl(v_balance) using errcode = 'P0001';
    end if;
  else
    select coalesce(sum(i.amount - i.paid_amount), 0) into v_balance from public.installments i join public.sales s on s.id = i.sale_id
      where i.customer_id = p_customer_id and not i.cancelled and s.status <> 'cancelled';
    if p_amount > v_balance then raise exception 'Valor prometido maior que o saldo devedor do cliente (%)', public.fmt_brl(v_balance) using errcode = 'P0001'; end if;
  end if;

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

-- -----------------------------------------------------------------------------
-- Caixa: dia conferido é imutável; fechamento serializado com os lançamentos da data
-- -----------------------------------------------------------------------------
create or replace function public.cash_adjustment(p_amount numeric, p_method public.payment_method, p_date date, p_justification text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.assert_owner();
  if p_amount is null or p_amount = 0 then raise exception 'Informe um valor diferente de zero' using errcode = 'P0001'; end if;
  if p_method is null then raise exception 'Informe a forma de pagamento' using errcode = 'P0001'; end if;
  if coalesce(length(trim(p_justification)), 0) < 5 then raise exception 'Justificativa obrigatória (mínimo 5 caracteres)' using errcode = 'P0001'; end if;
  if p_date is null or p_date > public.app_today() then raise exception 'Data inválida' using errcode = 'P0001'; end if;
  perform pg_advisory_xact_lock(hashtext('cash:' || p_date));
  if exists (select 1 from public.cash_closings where closing_date = p_date) then
    raise exception 'Este dia já foi conferido; lance o ajuste em uma data aberta' using errcode = 'P0001';
  end if;
  insert into public.cash_movements (kind, amount, method, occurred_on, description, created_by)
  values ('adjustment', round(p_amount, 2), p_method, p_date, trim(p_justification), auth.uid()) returning id into v_id;
  perform public.log_activity('cash_adjustment', 'cash_movements', v_id, null,
    'Ajuste de caixa de ' || public.fmt_brl(p_amount) || ' (' || public.method_label(p_method) || ', ' || public.fmt_date(p_date) || ') — ' || trim(p_justification),
    null, jsonb_build_object('amount', p_amount, 'method', p_method, 'date', p_date));
  return v_id;
end $$;

create or replace function public.close_cash_day(p_date date, p_counted_cash numeric, p_notes text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; t record;
begin
  perform public.assert_owner();
  if p_date is null or p_date > public.app_today() then raise exception 'Data inválida' using errcode = 'P0001'; end if;
  perform pg_advisory_xact_lock(hashtext('cash:' || p_date));
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
-- Dados existentes
-- -----------------------------------------------------------------------------
-- Movimentos de recebimento passam a apontar para quem recebeu.
update public.cash_movements m set created_by = p.created_by
from public.payments p
where m.payment_id = p.id and m.kind = 'payment' and p.created_by is not null and m.created_by is distinct from p.created_by;

-- Promessas pendentes de vendas já canceladas.
update public.payment_promises pp set status = 'cancelled', resolved_at = now()
where pp.status = 'pending'
  and pp.installment_id in (select i.id from public.installments i join public.sales s on s.id = i.sale_id where i.cancelled or s.status = 'cancelled');
