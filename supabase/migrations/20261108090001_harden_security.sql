-- =============================================================================
-- PLASCOTEL — Endurecimento de segurança
--   1. Grants mínimos para `authenticated` (remove os grants padrão do Supabase)
--   2. Políticas RLS com funções avaliadas uma vez por consulta: (select fn())
--   3. visit_customers / visits: escrita direta limitada às colunas usadas pelo app
--   4. Cadastro público (signUp) nasce INATIVO
--   5. Invariante "ao menos um proprietário ativo" vale para qualquer alteração
--   6. Comprovantes: registro amarrado ao objeto real no Storage; órfãos removíveis
--   7. Remoção de cliente de uma visita fica registrada no histórico
-- Executar como postgres (mesmo papel que cria as tabelas), por causa do
-- `alter default privileges`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Grants
-- O Supabase concede ALL em toda tabela nova a `authenticated`; sem revogar, os
-- grants por coluna abaixo não restringem nada e a única barreira seria o RLS.
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from authenticated;
revoke all on all sequences in schema public from authenticated;
alter default privileges in schema public revoke all on tables from authenticated;
alter default privileges in schema public revoke all on sequences from authenticated;

-- Leitura (filtrada por RLS). Tabelas novas precisam de grant explícito.
grant select on all tables in schema public to authenticated;

-- Escritas diretas permitidas (filtradas por RLS)
grant insert, update on public.customers, public.cities, public.products to authenticated; -- somente proprietário (RLS)
grant insert, delete on public.visits, public.visit_customers to authenticated;
grant update (visit_date, visit_time, notes, status, route_order) on public.visits to authenticated;
grant update (stop_order) on public.visit_customers to authenticated; -- status/notes só via set_visit_customer_status
grant insert on public.customer_notes, public.payment_receipts to authenticated;
grant insert, delete on public.notification_reads to authenticated;
grant insert, update on public.app_settings to authenticated; -- somente proprietário (RLS)
-- email, created_at, updated_at e id não são editáveis pelo cliente; updated_at é preenchido por trigger.
grant update (full_name, role, active) on public.profiles to authenticated; -- role/active: trigger + RLS (somente proprietário)

-- -----------------------------------------------------------------------------
-- 2. Políticas RLS (mesma semântica, funções em subselect => InitPlan único)
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','cities','customers','products','sales','sale_items','installments','payments','payment_receipts',
    'payment_postponements','payment_promises','visits','visit_customers','customer_notes','cash_movements',
    'cash_closings','activity_logs','app_settings'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select public.is_active_user()))', t || '_select', t);
  end loop;
end $$;

drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles for select to authenticated
  using (id = (select auth.uid()));
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid()) and (select public.is_active_user())) with check (id = (select auth.uid()));
drop policy if exists profiles_update_owner on public.profiles;
create policy profiles_update_owner on public.profiles for update to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

drop policy if exists customers_insert on public.customers;
create policy customers_insert on public.customers for insert to authenticated with check ((select public.is_owner()));
drop policy if exists customers_update on public.customers;
create policy customers_update on public.customers for update to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));
drop policy if exists cities_insert on public.cities;
create policy cities_insert on public.cities for insert to authenticated with check ((select public.is_owner()));
drop policy if exists cities_update on public.cities;
create policy cities_update on public.cities for update to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));
drop policy if exists products_insert on public.products;
create policy products_insert on public.products for insert to authenticated with check ((select public.is_owner()));
drop policy if exists products_update on public.products;
create policy products_update on public.products for update to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

-- Agenda: autoria não pode ser falsificada; exclusão de visita só proprietário
drop policy if exists visits_insert on public.visits;
create policy visits_insert on public.visits for insert to authenticated
  with check ((select public.is_active_user()) and created_by = (select auth.uid()));
drop policy if exists visits_update on public.visits;
create policy visits_update on public.visits for update to authenticated
  using ((select public.is_active_user())) with check ((select public.is_active_user()));
drop policy if exists visits_delete on public.visits;
create policy visits_delete on public.visits for delete to authenticated using ((select public.is_owner()));

-- Inclusão direta só como "A visitar"; atendimento é registrado pela RPC
drop policy if exists visit_customers_insert on public.visit_customers;
create policy visit_customers_insert on public.visit_customers for insert to authenticated
  with check ((select public.is_active_user()) and status = 'to_visit');
drop policy if exists visit_customers_update on public.visit_customers;
create policy visit_customers_update on public.visit_customers for update to authenticated
  using ((select public.is_active_user())) with check ((select public.is_active_user()));
drop policy if exists visit_customers_delete on public.visit_customers;
create policy visit_customers_delete on public.visit_customers for delete to authenticated
  using ((select public.is_active_user()) and status = 'to_visit');

drop policy if exists customer_notes_insert on public.customer_notes;
create policy customer_notes_insert on public.customer_notes for insert to authenticated
  with check ((select public.is_active_user()) and created_by = (select auth.uid()));

-- Comprovante: o registro precisa apontar para um objeto real do bucket, enviado
-- pelo próprio usuário, com tipo e tamanho iguais aos declarados.
drop policy if exists payment_receipts_insert on public.payment_receipts;
create policy payment_receipts_insert on public.payment_receipts for insert to authenticated
  with check (
    (select public.is_active_user()) and uploaded_by = (select auth.uid())
    and storage_path like 'payments/' || payment_id::text || '/%'
    and exists (
      select 1 from storage.objects o
      where o.bucket_id = 'receipts'
        and o.name = storage_path
        and o.owner_id = (select auth.uid())::text
        and o.metadata->>'mimetype' = mime_type
        and (o.metadata->>'size')::bigint = size_bytes
    )
  );

drop policy if exists notification_reads_all on public.notification_reads;
create policy notification_reads_all on public.notification_reads for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists notification_reads_insert on public.notification_reads;
create policy notification_reads_insert on public.notification_reads for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists notification_reads_delete on public.notification_reads;
create policy notification_reads_delete on public.notification_reads for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists app_settings_insert on public.app_settings;
create policy app_settings_insert on public.app_settings for insert to authenticated with check ((select public.is_owner()));
drop policy if exists app_settings_update on public.app_settings;
create policy app_settings_update on public.app_settings for update to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

-- -----------------------------------------------------------------------------
-- 3. Storage: nome de arquivo controlado e remoção apenas de órfãos do próprio usuário
-- -----------------------------------------------------------------------------
drop policy if exists receipts_read on storage.objects;
create policy receipts_read on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and (select public.is_active_user()));

drop policy if exists receipts_upload on storage.objects;
create policy receipts_upload on storage.objects for insert to authenticated
  with check (
    bucket_id = 'receipts' and (select public.is_active_user())
    and array_length(storage.foldername(name), 1) = 2
    and (storage.foldername(name))[1] = 'payments'
    and storage.filename(name) ~ '^[0-9a-f-]{36}\.(jpg|png|webp|heic|pdf)$'
    and exists (select 1 from public.payments p where p.id::text = (storage.foldername(name))[2])
  );

-- Comprovantes já registrados em payment_receipts continuam impossíveis de apagar ou
-- substituir (sem política de update). Só o próprio autor remove um upload que não
-- chegou a ser registrado (ex.: falha ao gravar o registro logo após o envio).
drop policy if exists receipts_delete_orphan on storage.objects;
create policy receipts_delete_orphan on storage.objects for delete to authenticated
  using (
    bucket_id = 'receipts' and owner_id = (select auth.uid())::text
    and not exists (select 1 from public.payment_receipts r where r.storage_path = storage.objects.name)
  );

-- -----------------------------------------------------------------------------
-- 4. visit_customers: autoria sempre do usuário real
-- -----------------------------------------------------------------------------
create or replace function public.visit_customers_set_actor() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    new.updated_by := auth.uid();
  end if;
  return new;
end $$;
revoke execute on function public.visit_customers_set_actor() from public, anon, authenticated;

drop trigger if exists visit_customers_actor on public.visit_customers;
create trigger visit_customers_actor before insert or update on public.visit_customers
  for each row execute function public.visit_customers_set_actor();

-- Reabrir um atendimento (voltar para "A visitar") é exclusivo do proprietário:
-- assim a política de delete (status = 'to_visit') impede apagar atendimento feito.
create or replace function public.set_visit_customer_status(p_visit_customer_id uuid, p_status public.visit_customer_status, p_notes text) returns void
language plpgsql security definer set search_path = public as $$
declare v_old public.visit_customer_status;
begin
  perform public.assert_active();
  if p_status is null then raise exception 'Informe a situação do atendimento' using errcode = 'P0001'; end if;
  select status into v_old from public.visit_customers where id = p_visit_customer_id for update;
  if not found then raise exception 'Registro de visita não encontrado' using errcode = 'P0001'; end if;
  if p_status = 'to_visit' and v_old <> 'to_visit' and not public.is_owner() then
    raise exception 'Somente o proprietário pode reabrir um atendimento' using errcode = 'P0001';
  end if;
  update public.visit_customers set status = p_status, notes = coalesce(nullif(trim(p_notes), ''), notes), updated_by = auth.uid()
  where id = p_visit_customer_id;
end $$;

-- -----------------------------------------------------------------------------
-- 5. Histórico: remoção de cliente da visita
-- -----------------------------------------------------------------------------
create or replace function public.on_visit_customer() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_date date; v_city text;
begin
  select v.visit_date, c.name into v_date, v_city
    from public.visits v join public.cities c on c.id = v.city_id
   where v.id = coalesce(new.visit_id, old.visit_id);

  if tg_op = 'DELETE' then
    -- Cascata da exclusão da visita: a visita já não existe e visits_audit registra a exclusão.
    if v_date is null then return old; end if;
    -- action 'visit' (já mapeada na linha do tempo e no filtro "Visitas" do histórico)
    perform public.log_activity('visit', 'visit_customers', old.id, old.customer_id,
      'Removido da visita de ' || coalesce(v_city, '?') || ' em ' || public.fmt_date(v_date), to_jsonb(old), null);
    return old;
  elsif tg_op = 'INSERT' then
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

drop trigger if exists visit_customers_after on public.visit_customers;
create trigger visit_customers_after after insert or update or delete on public.visit_customers
  for each row execute function public.on_visit_customer();

-- -----------------------------------------------------------------------------
-- 6. Novos usuários do Auth: cadastro público nasce inativo
-- Ativos de saída: o primeiro usuário do banco (proprietário) e quem foi criado
-- com app_metadata.role, que só a service role define (Configurações > Usuários).
-- -----------------------------------------------------------------------------
alter table public.profiles alter column active set default false;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_role public.app_role;
  v_first boolean;
  v_active boolean;
begin
  -- Serializa cadastros simultâneos para que só um vire o primeiro proprietário.
  perform pg_advisory_xact_lock(hashtext('profiles_first_owner'));
  v_first := not exists (select 1 from public.profiles);
  if v_first then
    v_role := 'owner';
  else
    v_role := coalesce((new.raw_app_meta_data->>'role')::public.app_role, 'employee');
  end if;
  v_active := v_first or coalesce(new.raw_app_meta_data ? 'role', false);
  insert into public.profiles (id, full_name, email, role, active)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), new.email, v_role, v_active);
  return new;
end $$;

-- -----------------------------------------------------------------------------
-- 7. Ao menos um proprietário ativo, independentemente de quem altera
-- -----------------------------------------------------------------------------
create or replace function public.guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.role is distinct from old.role or new.active is distinct from old.active) and not public.is_owner()
     and auth.uid() is not null then
    raise exception 'Apenas o proprietário pode alterar papéis ou status de usuários' using errcode = '42501';
  end if;
  if old.role = 'owner' and old.active and (new.role <> 'owner' or not new.active) then
    -- Fila para quem retira um proprietário; o EXISTS seguinte usa snapshot novo
    -- (READ COMMITTED) e enxerga a retirada confirmada pela transação anterior.
    perform pg_advisory_xact_lock(hashtext('profiles_owner_invariant'));
    if not exists (select 1 from public.profiles where role = 'owner' and active and id <> old.id) then
      raise exception 'É necessário manter ao menos um proprietário ativo' using errcode = 'P0001';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
