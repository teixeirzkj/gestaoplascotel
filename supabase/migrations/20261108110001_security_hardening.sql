-- =============================================================================
-- PLASCOTEL — Endurecimento de segurança (resultado dos testes de invasão)
-- 1. Bloqueio de força bruta no login (por e-mail e por IP), armazenado só como hash.
-- 2. Correções do Supabase Security Advisor: search_path fixo e funções de gatilho não executáveis via API.
-- =============================================================================

-- ---------- 1. Limite de tentativas de login ----------
create table if not exists public.login_attempts (
  id bigint generated always as identity primary key,
  email_hash text not null,
  ip_hash text not null,
  success boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists login_attempts_email_idx on public.login_attempts (email_hash, created_at desc);
create index if not exists login_attempts_ip_idx on public.login_attempts (ip_hash, created_at desc);

alter table public.login_attempts enable row level security;
-- Sem políticas: ninguém acessa pela API pública. Apenas as funções abaixo (service_role).
revoke all on public.login_attempts from anon, authenticated, public;

create or replace function public._login_hash(p text) returns text
language sql immutable set search_path = public, extensions as $$
  select encode(extensions.digest(lower(trim(coalesce(p, ''))), 'sha256'), 'hex')
$$;

-- Retorna quantos segundos o login deve aguardar (0 = liberado).
create or replace function public.login_throttle_check(p_email text, p_ip text) returns integer
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_email text := public._login_hash(p_email);
  v_ip text := public._login_hash(p_ip);
  v_window interval := interval '15 minutes';
  v_last_success timestamptz;
  v_fail_email int; v_oldest_email timestamptz;
  v_fail_ip int; v_oldest_ip timestamptz;
  v_wait int := 0;
begin
  select max(created_at) into v_last_success from public.login_attempts where email_hash = v_email and success;

  select count(*), min(created_at) into v_fail_email, v_oldest_email
  from (select created_at from public.login_attempts
        where email_hash = v_email and not success and created_at > now() - v_window
          and created_at > coalesce(v_last_success, '-infinity')
        order by created_at desc limit 5) t;
  if v_fail_email >= 5 then
    v_wait := greatest(v_wait, ceil(extract(epoch from (v_oldest_email + v_window - now())))::int);
  end if;

  select count(*), min(created_at) into v_fail_ip, v_oldest_ip
  from (select created_at from public.login_attempts
        where ip_hash = v_ip and not success and created_at > now() - v_window
        order by created_at desc limit 20) t;
  if v_fail_ip >= 20 then
    v_wait := greatest(v_wait, ceil(extract(epoch from (v_oldest_ip + v_window - now())))::int);
  end if;

  return greatest(v_wait, 0);
end $$;

create or replace function public.login_throttle_record(p_email text, p_ip text, p_success boolean) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  insert into public.login_attempts (email_hash, ip_hash, success)
  values (public._login_hash(p_email), public._login_hash(p_ip), p_success);
  -- higiene: guarda só 2 dias de histórico
  delete from public.login_attempts where created_at < now() - interval '2 days';
end $$;

revoke execute on function public._login_hash(text) from public, anon, authenticated;
revoke execute on function public.login_throttle_check(text, text) from public, anon, authenticated;
revoke execute on function public.login_throttle_record(text, text, boolean) from public, anon, authenticated;
grant execute on function public.login_throttle_check(text, text) to service_role;
grant execute on function public.login_throttle_record(text, text, boolean) to service_role;

-- ---------- 2. Security Advisor ----------
-- search_path fixo em funções utilitárias
alter function public.fmt_brl(numeric) set search_path = public, pg_catalog;
alter function public.fmt_date(date) set search_path = public, pg_catalog;
alter function public.method_label(public.payment_method) set search_path = public, pg_catalog;
alter function public.visit_status_label(public.visit_customer_status) set search_path = public, pg_catalog;
alter function public.jsonb_diff(jsonb, jsonb) set search_path = public, pg_catalog;
alter function public.touch_updated_at() set search_path = public, pg_catalog;
alter function public.app_today() set search_path = public, pg_catalog;

-- Funções de gatilho/internas: nunca chamáveis via /rest/v1/rpc
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (p.prorettype = 'trigger'::regtype
           or p.proname in ('log_activity', '_apply_payment_confirmation', '_refresh_sale_status',
                            'refresh_city_visit_dates', 'assert_active', 'assert_owner'))
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

-- Novas funções criadas no schema public não ficam executáveis por padrão
alter default privileges in schema public revoke execute on functions from public, anon;
