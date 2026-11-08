-- Pendências levantadas pelos corretores de outras áreas:
--   1. Índices para consultas por venda (detalhe da venda), por autor (filtro do histórico)
--      e por cliente (adiamentos na ficha do cliente).
--   2. reorder_visit_stops: reordena as paradas de uma visita num único UPDATE atômico.

create index if not exists payments_sale_idx on public.payments (sale_id);
create index if not exists activity_logs_actor_idx on public.activity_logs (actor_id, occurred_at desc);
create index if not exists payment_postponements_customer_idx on public.payment_postponements (customer_id, created_at desc);

-- security invoker: valem o grant de coluna (stop_order) e a RLS de visit_customers do usuário logado.
create or replace function public.reorder_visit_stops(p_visit uuid, p_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_total int;
  v_found int;
begin
  if not public.is_active_user() then
    raise exception 'Usuário sem permissão.';
  end if;
  if p_ids is null or cardinality(p_ids) = 0 then
    raise exception 'Informe a ordem das paradas.';
  end if;
  if (select count(distinct x) from unnest(p_ids) x) <> cardinality(p_ids) then
    raise exception 'A lista de paradas está desatualizada. Recarregue a página.';
  end if;

  -- trava as paradas da visita para não misturar duas reordenações simultâneas
  perform 1 from public.visit_customers where visit_id = p_visit for update;
  select count(*) into v_total from public.visit_customers where visit_id = p_visit;
  select count(*) into v_found from public.visit_customers where visit_id = p_visit and id = any (p_ids);
  if v_total = 0 or v_found <> v_total or v_found <> cardinality(p_ids) then
    raise exception 'A lista de paradas está desatualizada. Recarregue a página.';
  end if;

  update public.visit_customers vc
     set stop_order = o.ord
    from unnest(p_ids) with ordinality as o(id, ord)
   where vc.id = o.id
     and vc.visit_id = p_visit
     and vc.stop_order is distinct from o.ord::int;
end;
$$;

revoke execute on function public.reorder_visit_stops(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_visit_stops(uuid, uuid[]) to authenticated;
