-- Corrige audit_row: acesso a campos via jsonb (o gatilho é compartilhado por tabelas com colunas diferentes)
create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb; v_new jsonb; v_o jsonb; v_n jsonb;
  v_customer uuid; v_summary text; v_label text; r jsonb;
begin
  v_label := case tg_table_name
    when 'customers' then 'Cliente' when 'products' then 'Produto' when 'cities' then 'Cidade'
    when 'visits' then 'Visita' when 'profiles' then 'Usuário' else tg_table_name end;

  if tg_op = 'INSERT' then
    v_new := to_jsonb(new); r := v_new;
    v_customer := case when tg_table_name = 'customers' then (r->>'id')::uuid end;
    v_summary := case tg_table_name
      when 'customers' then 'Cliente cadastrado: ' || (r->>'full_name')
      when 'products' then 'Produto cadastrado: ' || (r->>'name')
      when 'cities' then 'Cidade cadastrada: ' || (r->>'name') || '/' || (r->>'state')
      when 'visits' then 'Visita agendada para ' || public.fmt_date((r->>'visit_date')::date)
      else v_label || ' criado(a)' end;
    perform public.log_activity('create', tg_table_name, (r->>'id')::uuid, v_customer, v_summary, null, v_new);
    return new;
  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old); v_new := to_jsonb(new); r := v_new;
    select o, n into v_o, v_n from public.jsonb_diff(v_old, v_new);
    if v_n = '{}'::jsonb then return new; end if;
    v_customer := case when tg_table_name = 'customers' then (r->>'id')::uuid end;
    v_summary := case
      when tg_table_name = 'customers' and v_n ? 'archived_at' and r->>'archived_at' is not null then 'Cliente arquivado'
      when tg_table_name = 'customers' and v_n ? 'archived_at' and r->>'archived_at' is null then 'Cliente reativado'
      when tg_table_name = 'customers' and (select count(*) from jsonb_object_keys(v_n)) = 1 and v_n ? 'last_contact_at' then null
      when tg_table_name = 'customers' then 'Dados do cliente alterados'
      when tg_table_name = 'cities' and (select count(*) from jsonb_object_keys(v_n) k where k not in ('last_visit_date', 'next_visit_date')) = 0 then null
      when tg_table_name = 'visits' and v_n ? 'status' then 'Visita ' || case r->>'status' when 'done' then 'realizada' when 'cancelled' then 'cancelada' else 'reaberta' end
        || ' (' || public.fmt_date((r->>'visit_date')::date) || ')'
      when tg_table_name = 'profiles' and v_n ? 'role' then 'Papel do usuário ' || (r->>'full_name') || ' alterado para '
        || case r->>'role' when 'owner' then 'proprietário' else 'funcionário' end
      when tg_table_name = 'profiles' and v_n ? 'active' then 'Usuário ' || (r->>'full_name') || case when (r->>'active')::boolean then ' reativado' else ' desativado' end
      when tg_table_name = 'products' then 'Produto alterado: ' || (r->>'name')
      when tg_table_name = 'cities' then 'Cidade alterada: ' || (r->>'name')
      else v_label || ' alterado(a)' end;
    if v_summary is null then return new; end if;
    perform public.log_activity('update', tg_table_name, (r->>'id')::uuid, v_customer, v_summary, v_o, v_n);
    return new;
  else
    v_old := to_jsonb(old);
    perform public.log_activity('delete', tg_table_name, (v_old->>'id')::uuid, null, v_label || ' removido(a)', v_old, null);
    return old;
  end if;
end $$;
