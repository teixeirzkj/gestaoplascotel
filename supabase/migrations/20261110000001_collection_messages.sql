-- =============================================================================
-- PLASCOTEL — Mensagens de cobrança (envio assistido pelo WhatsApp)
-- O sistema monta a fila do dia; o funcionário envia pelo WhatsApp com um toque e o envio é registrado.
-- Preparado para, no futuro, um provedor de API (canal 'api') enviar automaticamente pela mesma fila.
-- =============================================================================

-- Cliente pode optar por não receber mensagens de cobrança
alter table public.customers
  add column if not exists messages_opt_out boolean not null default false,
  add column if not exists messages_opt_out_reason text,
  add column if not exists messages_opt_out_at timestamptz;

create table if not exists public.customer_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null,                    -- uma mensagem pode cobrir várias parcelas
  customer_id uuid not null references public.customers(id),
  installment_id uuid references public.installments(id),
  promise_id uuid references public.payment_promises(id),
  payment_id uuid references public.payments(id),
  kind text not null check (kind in ('before_due', 'due_today', 'overdue_3', 'overdue_7', 'overdue_15', 'promise', 'thanks')),
  ref_date date not null,                    -- data de cobrança/promessa/pagamento à qual a mensagem se refere
  status text not null check (status in ('sent', 'skipped')),
  skip_reason text,
  body text,
  amount numeric(12,2),
  channel text not null default 'whatsapp_assisted' check (channel in ('whatsapp_assisted', 'api')),
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  check (installment_id is not null or promise_id is not null or payment_id is not null)
);

-- Cada etapa do calendário vale uma vez por parcela e data de cobrança (um adiamento reinicia o ciclo)
create unique index if not exists customer_messages_installment_uq on public.customer_messages (installment_id, kind, ref_date) where installment_id is not null;
create unique index if not exists customer_messages_promise_uq on public.customer_messages (promise_id, kind) where promise_id is not null;
create unique index if not exists customer_messages_payment_uq on public.customer_messages (payment_id, kind) where payment_id is not null;
create index if not exists customer_messages_customer_idx on public.customer_messages (customer_id, created_at desc);
create index if not exists customer_messages_created_idx on public.customer_messages (created_at desc);

alter table public.customer_messages enable row level security;
revoke all on public.customer_messages from anon, public;
grant select on public.customer_messages to authenticated;
create policy customer_messages_select on public.customer_messages for select to authenticated using (public.is_active_user());
-- Escrita somente pela RPC abaixo.

create or replace function public.message_kind_label(k text) returns text
language sql immutable set search_path = public, pg_catalog as $$
  select case k
    when 'before_due' then 'lembrete antes do vencimento' when 'due_today' then 'vencimento hoje'
    when 'overdue_3' then 'atraso (3 dias)' when 'overdue_7' then 'atraso (7 dias)' when 'overdue_15' then 'atraso (15 dias)'
    when 'promise' then 'promessa de pagamento' when 'thanks' then 'agradecimento pelo pagamento' else k end
$$;

-- Registra envio (ou pulo) de uma mensagem. Idempotente: clique duplo não duplica registro.
-- p_installments: [{ "id": uuid, "ref_date": "YYYY-MM-DD" }]
create or replace function public.record_customer_message(
  p_customer_id uuid, p_kind text, p_status text, p_body text, p_amount numeric,
  p_installments jsonb, p_promise_id uuid, p_payment_id uuid, p_ref_date date, p_skip_reason text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_group uuid := gen_random_uuid();
  v_item jsonb; v_count int := 0; v_name text;
begin
  perform public.assert_active();
  if p_status not in ('sent', 'skipped') then raise exception 'Situação inválida' using errcode = 'P0001'; end if;
  if p_kind not in ('before_due', 'due_today', 'overdue_3', 'overdue_7', 'overdue_15', 'promise', 'thanks') then
    raise exception 'Tipo de mensagem inválido' using errcode = 'P0001';
  end if;
  if p_status = 'skipped' and coalesce(length(trim(p_skip_reason)), 0) < 3 then
    raise exception 'Informe o motivo para pular a mensagem' using errcode = 'P0001';
  end if;
  select full_name into v_name from public.customers where id = p_customer_id;
  if v_name is null then raise exception 'Cliente não encontrado' using errcode = 'P0001'; end if;

  if jsonb_typeof(p_installments) = 'array' then
    for v_item in select * from jsonb_array_elements(p_installments) loop
      if not exists (select 1 from public.installments where id = (v_item->>'id')::uuid and customer_id = p_customer_id) then
        raise exception 'Parcela não pertence ao cliente' using errcode = 'P0001';
      end if;
      insert into public.customer_messages (group_id, customer_id, installment_id, kind, ref_date, status, skip_reason, body, amount)
      values (v_group, p_customer_id, (v_item->>'id')::uuid, p_kind, (v_item->>'ref_date')::date, p_status, nullif(trim(p_skip_reason), ''), p_body, p_amount)
      on conflict do nothing;
      get diagnostics v_count = row_count;
    end loop;
  end if;

  if p_promise_id is not null then
    if not exists (select 1 from public.payment_promises where id = p_promise_id and customer_id = p_customer_id) then
      raise exception 'Promessa não pertence ao cliente' using errcode = 'P0001';
    end if;
    insert into public.customer_messages (group_id, customer_id, promise_id, kind, ref_date, status, skip_reason, body, amount)
    values (v_group, p_customer_id, p_promise_id, p_kind, coalesce(p_ref_date, public.app_today()), p_status, nullif(trim(p_skip_reason), ''), p_body, p_amount)
    on conflict do nothing;
    get diagnostics v_count = row_count;
  end if;

  if p_payment_id is not null then
    if not exists (select 1 from public.payments where id = p_payment_id and customer_id = p_customer_id) then
      raise exception 'Pagamento não pertence ao cliente' using errcode = 'P0001';
    end if;
    insert into public.customer_messages (group_id, customer_id, payment_id, kind, ref_date, status, skip_reason, body, amount)
    values (v_group, p_customer_id, p_payment_id, p_kind, coalesce(p_ref_date, public.app_today()), p_status, nullif(trim(p_skip_reason), ''), p_body, p_amount)
    on conflict do nothing;
    get diagnostics v_count = row_count;
  end if;

  if not exists (select 1 from public.customer_messages where group_id = v_group) then
    return null; -- já registrado antes (clique duplo)
  end if;

  perform public.log_activity(
    case when p_status = 'sent' then 'message_sent' else 'message_skipped' end, 'customer_messages', v_group, p_customer_id,
    case when p_status = 'sent'
      then 'Mensagem de ' || public.message_kind_label(p_kind) || ' enviada pelo WhatsApp' || coalesce(' (' || public.fmt_brl(p_amount) || ')', '')
      else 'Mensagem de ' || public.message_kind_label(p_kind) || ' não enviada — ' || trim(p_skip_reason) end,
    null, jsonb_build_object('kind', p_kind, 'status', p_status, 'body', p_body));

  if p_status = 'sent' then
    update public.customers set last_contact_at = now() where id = p_customer_id;
  end if;
  return v_group;
end $$;

-- Opt-out: qualquer usuário ativo registra o pedido do cliente (fica na auditoria)
create or replace function public.set_customer_messages_opt_out(p_customer_id uuid, p_opt_out boolean, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_active();
  if p_opt_out and coalesce(length(trim(p_reason)), 0) < 3 then raise exception 'Informe o motivo' using errcode = 'P0001'; end if;
  update public.customers set
    messages_opt_out = p_opt_out,
    messages_opt_out_reason = case when p_opt_out then trim(p_reason) else null end,
    messages_opt_out_at = case when p_opt_out then now() else null end
  where id = p_customer_id;
  if not found then raise exception 'Cliente não encontrado' using errcode = 'P0001'; end if;
  perform public.log_activity('message_opt_out', 'customers', p_customer_id, p_customer_id,
    case when p_opt_out then 'Cliente não receberá mensagens de cobrança — ' || trim(p_reason) else 'Cliente voltou a receber mensagens de cobrança' end);
end $$;

revoke execute on function public.record_customer_message(uuid, text, text, text, numeric, jsonb, uuid, uuid, date, text) from public, anon;
revoke execute on function public.set_customer_messages_opt_out(uuid, boolean, text) from public, anon;
grant execute on function public.record_customer_message(uuid, text, text, text, numeric, jsonb, uuid, uuid, date, text) to authenticated;
grant execute on function public.set_customer_messages_opt_out(uuid, boolean, text) to authenticated;
grant execute on function public.message_kind_label(text) to authenticated;

-- Configuração padrão das mensagens (editável pelo proprietário)
insert into public.app_settings (key, value) values ('messages', jsonb_build_object(
  'enabled', true,
  'pix', jsonb_build_object('key', null, 'name', 'PLASCOTEL', 'city', 'JACOBINA'),
  'steps', jsonb_build_object(
    'before_due', jsonb_build_object('enabled', true, 'days', 3),
    'due_today', jsonb_build_object('enabled', true),
    'overdue_3', jsonb_build_object('enabled', true),
    'overdue_7', jsonb_build_object('enabled', true),
    'overdue_15', jsonb_build_object('enabled', true),
    'promise', jsonb_build_object('enabled', true),
    'thanks', jsonb_build_object('enabled', true)
  ),
  'templates', '{}'::jsonb
)) on conflict (key) do nothing;
