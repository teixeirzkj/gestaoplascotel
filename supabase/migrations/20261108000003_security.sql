-- =============================================================================
-- PLASCOTEL — Segurança: RLS, grants e Storage
-- Leitura: qualquer usuário ATIVO (proprietário ou funcionário).
-- Escrita em tabelas financeiras: NUNCA direta — somente via RPC (security definer),
-- que valida papel e regras. Não existem políticas de DELETE em dados financeiros.
-- =============================================================================

-- Anônimos não acessam nada
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon, public;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke execute on functions from anon, public;

grant usage on schema public to authenticated;
grant select on all tables in schema public to authenticated;

-- RPCs disponíveis para usuários autenticados (cada uma valida o papel internamente)
grant execute on function
  public.app_today(), public.is_owner(), public.is_active_user(), public.current_role_name(),
  public.fmt_brl(numeric), public.fmt_date(date), public.method_label(public.payment_method), public.visit_status_label(public.visit_customer_status),
  public.create_sale(jsonb), public.cancel_sale(uuid, text),
  public.register_payment(uuid, numeric, date, public.payment_method, text, boolean, uuid),
  public.confirm_payment(uuid), public.reject_payment(uuid, text), public.reverse_payment(uuid, text),
  public.postpone_installment(uuid, date, text, text, public.payment_method, boolean),
  public.create_promise(uuid, uuid, numeric, date, public.payment_method, text),
  public.resolve_promise(uuid, public.promise_status, text),
  public.cash_adjustment(numeric, public.payment_method, date, text), public.cash_day_summary(date), public.close_cash_day(date, numeric, text),
  public.set_visit_customer_status(uuid, public.visit_customer_status, text), public.customers_to_visit(uuid),
  public.dashboard_summary(), public.monthly_series(int), public.report_summary(date, date), public.report_by_city(date, date),
  public.delinquency_aging(), public.get_notifications(), public.global_search(text)
to authenticated;

-- Funções internas: ninguém chama diretamente
revoke execute on function public.log_activity(text, text, uuid, uuid, text, jsonb, jsonb) from authenticated;
revoke execute on function public._apply_payment_confirmation(uuid) from authenticated;
revoke execute on function public._refresh_sale_status(uuid) from authenticated;
revoke execute on function public.refresh_city_visit_dates(uuid) from authenticated;
revoke execute on function public.assert_active() from authenticated;
revoke execute on function public.assert_owner() from authenticated;

-- Escritas diretas permitidas (filtradas por RLS abaixo)
grant insert, update on public.customers, public.cities, public.products to authenticated;
grant insert, update, delete on public.visits, public.visit_customers to authenticated;
grant insert on public.customer_notes, public.payment_receipts to authenticated;
grant insert, delete on public.notification_reads to authenticated;
grant insert, update on public.app_settings to authenticated;
grant update (full_name) on public.profiles to authenticated;
grant update (role, active) on public.profiles to authenticated; -- protegido por trigger + RLS (somente proprietário)

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','cities','customers','products','sales','sale_items','installments','payments','payment_receipts',
    'payment_postponements','payment_promises','visits','visit_customers','customer_notes','cash_movements',
    'cash_closings','activity_logs','notification_reads','app_settings'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Leitura para usuários ativos
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','cities','customers','products','sales','sale_items','installments','payments','payment_receipts',
    'payment_postponements','payment_promises','visits','visit_customers','customer_notes','cash_movements',
    'cash_closings','activity_logs','app_settings'
  ] loop
    execute format('create policy %I on public.%I for select to authenticated using (public.is_active_user())', t || '_select', t);
  end loop;
end $$;

-- Perfil próprio sempre visível (para detectar usuário inativo)
create policy profiles_select_self on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid() and public.is_active_user()) with check (id = auth.uid());
create policy profiles_update_owner on public.profiles for update to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- Cadastros: somente proprietário cria/edita (clientes são arquivados, nunca excluídos)
create policy customers_insert on public.customers for insert to authenticated with check (public.is_owner());
create policy customers_update on public.customers for update to authenticated using (public.is_owner()) with check (public.is_owner());
create policy cities_insert on public.cities for insert to authenticated with check (public.is_owner());
create policy cities_update on public.cities for update to authenticated using (public.is_owner()) with check (public.is_owner());
create policy products_insert on public.products for insert to authenticated with check (public.is_owner());
create policy products_update on public.products for update to authenticated using (public.is_owner()) with check (public.is_owner());

-- Agenda: funcionário consulta e registra visitas; exclusão de visita só proprietário
create policy visits_insert on public.visits for insert to authenticated with check (public.is_active_user());
create policy visits_update on public.visits for update to authenticated using (public.is_active_user()) with check (public.is_active_user());
create policy visits_delete on public.visits for delete to authenticated using (public.is_owner());
create policy visit_customers_insert on public.visit_customers for insert to authenticated with check (public.is_active_user());
create policy visit_customers_update on public.visit_customers for update to authenticated using (public.is_active_user()) with check (public.is_active_user());
create policy visit_customers_delete on public.visit_customers for delete to authenticated using (public.is_active_user() and status = 'to_visit');

-- Observações e comprovantes: qualquer usuário ativo adiciona, ninguém altera/apaga
create policy customer_notes_insert on public.customer_notes for insert to authenticated
  with check (public.is_active_user() and created_by = auth.uid());
create policy payment_receipts_insert on public.payment_receipts for insert to authenticated
  with check (public.is_active_user() and uploaded_by = auth.uid()
              and storage_path like 'payments/' || payment_id::text || '/%');

-- Notificações lidas: cada usuário controla as suas
create policy notification_reads_all on public.notification_reads for select to authenticated using (user_id = auth.uid());
create policy notification_reads_insert on public.notification_reads for insert to authenticated with check (user_id = auth.uid());
create policy notification_reads_delete on public.notification_reads for delete to authenticated using (user_id = auth.uid());

-- Configurações: somente proprietário altera
create policy app_settings_insert on public.app_settings for insert to authenticated with check (public.is_owner());
create policy app_settings_update on public.app_settings for update to authenticated using (public.is_owner()) with check (public.is_owner());

-- activity_logs, sales, sale_items, installments, payments, payment_postponements, payment_promises,
-- cash_movements, cash_closings: SEM políticas de escrita => somente RPCs security definer escrevem.
