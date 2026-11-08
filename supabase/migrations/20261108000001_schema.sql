-- =============================================================================
-- PLASCOTEL — Schema principal
-- Valores monetários: numeric(12,2). Datas de negócio: date (fuso America/Bahia).
-- Separação fundamental:
--   installments.original_due_date  -> vencimento financeiro (nunca muda após criação, salvo ajuste do proprietário)
--   installments.collection_date    -> data atual de cobrança (muda com adiamentos)
--   visits.visit_date               -> data de visita à cidade (independente das duas acima)
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
create type public.app_role as enum ('owner', 'employee');
create type public.payment_method as enum ('pix', 'cash', 'transfer', 'other');
create type public.sale_status as enum ('open', 'paid', 'cancelled');
create type public.payment_status as enum ('pending_confirmation', 'confirmed', 'rejected', 'reversed');
create type public.promise_status as enum ('pending', 'kept', 'broken', 'cancelled');
create type public.visit_status as enum ('planned', 'done', 'cancelled');
create type public.visit_customer_status as enum ('to_visit', 'visited', 'not_found', 'payment_received', 'rescheduled');
create type public.cash_movement_kind as enum ('payment', 'reversal', 'adjustment');
create type public.note_kind as enum ('note', 'contact', 'collection');

-- -----------------------------------------------------------------------------
-- Utilitários
-- -----------------------------------------------------------------------------
create or replace function public.app_today() returns date
language sql stable as $$ select (now() at time zone 'America/Bahia')::date $$;

-- -----------------------------------------------------------------------------
-- Perfis / papéis
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text,
  role public.app_role not null default 'employee',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.current_role_name() returns public.app_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create or replace function public.is_active_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active)
$$;

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active and role = 'owner')
$$;

-- Novo usuário do Auth => perfil. O primeiro usuário do sistema vira proprietário.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_role public.app_role;
begin
  if not exists (select 1 from public.profiles) then
    v_role := 'owner';
  else
    v_role := coalesce((new.raw_app_meta_data->>'role')::public.app_role, 'employee');
  end if;
  insert into public.profiles (id, full_name, email, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), new.email, v_role);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Impede que um não-proprietário altere papel/status (inclusive o próprio).
create or replace function public.guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.role is distinct from old.role or new.active is distinct from old.active) and not public.is_owner()
     and auth.uid() is not null then
    raise exception 'Apenas o proprietário pode alterar papéis ou status de usuários' using errcode = '42501';
  end if;
  if new.id = auth.uid() and old.role = 'owner' and (new.role <> 'owner' or not new.active) then
    if (select count(*) from public.profiles where role = 'owner' and active and id <> old.id) = 0 then
      raise exception 'É necessário manter ao menos um proprietário ativo' using errcode = 'P0001';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_update();

-- -----------------------------------------------------------------------------
-- Cadastros
-- -----------------------------------------------------------------------------
create table public.cities (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  state char(2) not null default 'BA',
  notes text,
  last_visit_date date,
  next_visit_date date,
  archived boolean not null default false,
  -- Preparado para mapas/rotas futuras
  latitude numeric(9,6),
  longitude numeric(9,6),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index cities_name_state_uq on public.cities (lower(name), state);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(trim(full_name)) > 1),
  phone text,
  whatsapp text,
  city_id uuid references public.cities(id),
  neighborhood text,
  address text,
  reference text,
  notes text,
  -- Preparado para mapas/rotas futuras
  latitude numeric(9,6),
  longitude numeric(9,6),
  last_contact_at timestamptz,
  archived_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index customers_city_idx on public.customers (city_id);
create index customers_name_idx on public.customers (lower(full_name));
create index customers_phone_idx on public.customers (phone);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  category text,
  description text,
  price numeric(12,2) not null default 0 check (price >= 0),
  active boolean not null default true,
  -- Preparado para controle de estoque (não utilizado na v1)
  track_stock boolean not null default false,
  stock_quantity numeric(12,3),
  sku text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Vendas
-- -----------------------------------------------------------------------------
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  code bigint generated always as identity unique,
  customer_id uuid not null references public.customers(id),
  city_id uuid references public.cities(id),
  sale_date date not null default public.app_today(),
  subtotal numeric(12,2) not null check (subtotal >= 0),
  discount numeric(12,2) not null default 0 check (discount >= 0),
  total numeric(12,2) not null check (total >= 0),
  down_payment numeric(12,2) not null default 0 check (down_payment >= 0),
  payment_method public.payment_method,
  conditions text,
  installments_count int not null default 0 check (installments_count >= 0),
  notes text,
  status public.sale_status not null default 'open',
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles(id),
  cancel_reason text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (total = subtotal - discount),
  check (down_payment <= total)
);
create index sales_customer_idx on public.sales (customer_id);
create index sales_date_idx on public.sales (sale_date);
create index sales_city_idx on public.sales (city_id);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid references public.products(id),
  description text not null,
  quantity numeric(12,3) not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  discount numeric(12,2) not null default 0 check (discount >= 0),
  total numeric(12,2) not null check (total >= 0),
  created_at timestamptz not null default now()
);
create index sale_items_sale_idx on public.sale_items (sale_id);

-- number = 0 representa a entrada
create table public.installments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id),
  customer_id uuid not null references public.customers(id),
  number int not null check (number >= 0),
  amount numeric(12,2) not null check (amount > 0),
  paid_amount numeric(12,2) not null default 0 check (paid_amount >= 0),
  original_due_date date not null,
  collection_date date not null,
  needs_visit boolean not null default false,
  expected_channel public.payment_method,
  postponed_count int not null default 0,
  cancelled boolean not null default false,
  notes text,
  paid_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sale_id, number),
  check (paid_amount <= amount)
);
create index installments_customer_idx on public.installments (customer_id);
create index installments_collection_idx on public.installments (collection_date) where paid_amount < amount and not cancelled;

-- -----------------------------------------------------------------------------
-- Pagamentos
-- -----------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  installment_id uuid not null references public.installments(id),
  sale_id uuid not null references public.sales(id),
  customer_id uuid not null references public.customers(id),
  amount numeric(12,2) not null check (amount > 0),
  paid_on date not null default public.app_today(),
  method public.payment_method not null,
  notes text,
  status public.payment_status not null default 'pending_confirmation',
  idempotency_key uuid not null unique,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  confirmed_by uuid references public.profiles(id),
  confirmed_at timestamptz,
  rejected_by uuid references public.profiles(id),
  rejected_at timestamptz,
  reversed_by uuid references public.profiles(id),
  reversed_at timestamptz,
  status_reason text
);
create index payments_installment_idx on public.payments (installment_id);
create index payments_customer_idx on public.payments (customer_id);
create index payments_paid_on_idx on public.payments (paid_on);

create table public.payment_receipts (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id),
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','image/heic','application/pdf')),
  size_bytes int not null check (size_bytes > 0 and size_bytes <= 10485760),
  uploaded_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index payment_receipts_payment_idx on public.payment_receipts (payment_id);

create table public.payment_postponements (
  id uuid primary key default gen_random_uuid(),
  installment_id uuid not null references public.installments(id),
  customer_id uuid not null references public.customers(id),
  previous_date date not null,
  new_date date not null,
  reason text not null,
  notes text,
  expected_channel public.payment_method,
  needs_visit boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index postponements_installment_idx on public.payment_postponements (installment_id);

create table public.payment_promises (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  installment_id uuid references public.installments(id),
  promised_on date not null default public.app_today(),
  amount numeric(12,2) not null check (amount > 0),
  due_date date not null,
  expected_method public.payment_method,
  notes text,
  status public.promise_status not null default 'pending',
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index promises_customer_idx on public.payment_promises (customer_id);

-- -----------------------------------------------------------------------------
-- Agenda / visitas
-- -----------------------------------------------------------------------------
create table public.visits (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id),
  visit_date date not null,
  visit_time time,
  notes text,
  status public.visit_status not null default 'planned',
  -- Preparado para roteirização futura
  route_order int,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index visits_date_idx on public.visits (visit_date);

create table public.visit_customers (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.visits(id) on delete cascade,
  customer_id uuid not null references public.customers(id),
  status public.visit_customer_status not null default 'to_visit',
  notes text,
  stop_order int,
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (visit_id, customer_id)
);

-- -----------------------------------------------------------------------------
-- Observações, caixa, auditoria, notificações, configurações
-- -----------------------------------------------------------------------------
create table public.customer_notes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  kind public.note_kind not null default 'note',
  body text not null check (length(trim(body)) > 0),
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index customer_notes_customer_idx on public.customer_notes (customer_id);

create table public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  kind public.cash_movement_kind not null,
  payment_id uuid references public.payments(id),
  amount numeric(12,2) not null check (amount <> 0), -- negativo = saída/estorno
  method public.payment_method not null,
  occurred_on date not null,
  description text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index cash_movements_date_idx on public.cash_movements (occurred_on);

create table public.cash_closings (
  id uuid primary key default gen_random_uuid(),
  closing_date date not null unique,
  expected_total numeric(12,2) not null,
  expected_pix numeric(12,2) not null,
  expected_cash numeric(12,2) not null,
  expected_transfer numeric(12,2) not null,
  expected_other numeric(12,2) not null,
  counted_cash numeric(12,2),
  divergence numeric(12,2) not null default 0,
  notes text,
  closed_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.activity_logs (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  customer_id uuid references public.customers(id),
  summary text not null,
  old_data jsonb,
  new_data jsonb
);
create index activity_logs_customer_idx on public.activity_logs (customer_id, occurred_at desc);
create index activity_logs_time_idx on public.activity_logs (occurred_at desc);
create index activity_logs_entity_idx on public.activity_logs (entity_type, entity_id);

create table public.notification_reads (
  user_id uuid not null references public.profiles(id) on delete cascade,
  notification_key text not null,
  read_at timestamptz not null default now(),
  primary key (user_id, notification_key)
);

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value) values
  ('company', '{"name":"PLASCOTEL","document":null,"phone":null,"pix_key":null}'::jsonb),
  ('billing', '{"default_interval_days":30,"due_soon_days":3,"visit_soon_days":3}'::jsonb);

-- updated_at genérico
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create trigger cities_touch before update on public.cities for each row execute function public.touch_updated_at();
create trigger customers_touch before update on public.customers for each row execute function public.touch_updated_at();
create trigger products_touch before update on public.products for each row execute function public.touch_updated_at();
create trigger sales_touch before update on public.sales for each row execute function public.touch_updated_at();
create trigger installments_touch before update on public.installments for each row execute function public.touch_updated_at();
create trigger visits_touch before update on public.visits for each row execute function public.touch_updated_at();
create trigger visit_customers_touch before update on public.visit_customers for each row execute function public.touch_updated_at();
