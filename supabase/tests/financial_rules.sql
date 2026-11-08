-- Testes de regras financeiras e permissões. Executar com: node scripts/db.mjs file supabase/tests/financial_rules.sql
-- Tudo roda em um bloco que termina com exceção proposital => NADA é persistido.
do $test$
declare
  v_owner uuid := gen_random_uuid();
  v_emp uuid := gen_random_uuid();
  v_city uuid; v_cust uuid; v_cust2 uuid; v_prod uuid; v_sale uuid; v_sale2 uuid;
  v_inst1 uuid; v_inst2 uuid; v_pay uuid; v_pay2 uuid; v_id uuid; v_promise uuid;
  v_num numeric; v_cash_base numeric; v_txt text; v_cnt int; v_ok boolean; v_today date := public.app_today();
  passed int := 0;
  procedure_dummy int;
begin
  -- ---------- setup (como postgres) ----------
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (v_owner, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner.test@plascotel.local', '{}', '{"full_name":"Dono Teste"}', now(), now()),
         (v_emp, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp.test@plascotel.local', '{}', '{"full_name":"Func Teste"}', now(), now());
  -- Sem app_metadata.role o perfil nasce inativo (cadastro público); ativa manualmente.
  if (select active from public.profiles where id = v_emp) then raise exception 'FALHA: usuário sem app_metadata.role nasceu ativo'; end if;
  update public.profiles set role = 'owner', active = true where id = v_owner;
  update public.profiles set role = 'employee', active = true where id = v_emp;

  -- Caixa de hoje antes dos lançamentos do teste (o banco pode ter dados reais)
  select coalesce(sum(amount), 0) into v_cash_base from public.cash_movements where occurred_on = v_today;
  if exists (select 1 from public.cash_closings where closing_date = v_today) then
    raise exception 'O caixa de hoje já foi conferido neste banco; rode a suíte em outro dia ou num banco sem conferência de hoje';
  end if;

  -- ---------- como PROPRIETÁRIO ----------
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  if not public.is_owner() then raise exception 'FALHA: owner não reconhecido'; end if; passed := passed + 1;

  insert into public.cities (name, state) values ('Cidade Teste ' || left(gen_random_uuid()::text, 8), 'BA') returning id into v_city;
  insert into public.customers (full_name, phone, city_id) values ('João Teste', '74999990000', v_city) returning id into v_cust;
  insert into public.customers (full_name, phone, city_id) values ('Maria Teste', '74999991111', v_city) returning id into v_cust2;
  insert into public.products (name, category, price) values ('Cama Box Casal', 'Camas', 800) returning id into v_prod;
  passed := passed + 1;

  -- Venda parcelada: 2 itens, desconto 50, entrada 100 recebida, 3 parcelas
  -- total = 800*1 + 150*2 - 50 = 1050 ; entrada 100 ; parcelas 316.67+316.67+316.66 = 950
  v_sale := public.create_sale(jsonb_build_object(
    'customer_id', v_cust, 'sale_date', v_today, 'discount', 50, 'down_payment', 100, 'down_payment_received', true,
    'down_payment_method', 'pix', 'payment_method', 'pix', 'idempotency_key', '11111111-1111-1111-1111-111111111111',
    'items', jsonb_build_array(
      jsonb_build_object('product_id', v_prod, 'quantity', 1, 'unit_price', 800),
      jsonb_build_object('description', 'Travesseiro', 'quantity', 2, 'unit_price', 150)),
    'installments', jsonb_build_array(
      jsonb_build_object('amount', 316.67, 'due_date', v_today - 10),
      jsonb_build_object('amount', 316.67, 'due_date', v_today + 20),
      jsonb_build_object('amount', 316.66, 'due_date', v_today + 50))));
  select total into v_num from public.sales where id = v_sale;
  if v_num <> 1050 then raise exception 'FALHA: total da venda %', v_num; end if; passed := passed + 1;

  -- Idempotência: mesma chave devolve a mesma venda
  if public.create_sale(jsonb_build_object('idempotency_key', '11111111-1111-1111-1111-111111111111')) <> v_sale then
    raise exception 'FALHA: idempotência de venda'; end if; passed := passed + 1;

  select count(*) into v_cnt from public.installments where sale_id = v_sale;
  if v_cnt <> 4 then raise exception 'FALHA: esperado 4 parcelas (entrada + 3), obtido %', v_cnt; end if; passed := passed + 1;

  select balance into v_num from public.v_sales where id = v_sale;
  if v_num <> 950 then raise exception 'FALHA: saldo após entrada %', v_num; end if; passed := passed + 1;

  -- Soma divergente deve falhar
  begin
    perform public.create_sale(jsonb_build_object('customer_id', v_cust, 'idempotency_key', gen_random_uuid(),
      'items', jsonb_build_array(jsonb_build_object('description', 'X', 'quantity', 1, 'unit_price', 100)),
      'installments', jsonb_build_array(jsonb_build_object('amount', 90, 'due_date', v_today))));
    raise exception 'FALHA: aceitou soma divergente';
  exception when sqlstate 'P0001' then passed := passed + 1; end;

  -- Venda à vista para cliente 2 (quitada no ato)
  v_sale2 := public.create_sale(jsonb_build_object('customer_id', v_cust2, 'idempotency_key', gen_random_uuid(),
    'down_payment', 200, 'down_payment_received', true, 'payment_method', 'cash',
    'items', jsonb_build_array(jsonb_build_object('description', 'Colchão', 'quantity', 1, 'unit_price', 200))));
  if (select status from public.sales where id = v_sale2) <> 'paid' then raise exception 'FALHA: venda à vista não quitada'; end if;
  if (select financial_status from public.v_customers where id = v_cust2) <> 'paid_off' then raise exception 'FALHA: cliente 2 deveria estar quitado'; end if;
  passed := passed + 1;

  select id into v_inst1 from public.installments where sale_id = v_sale and number = 1;
  select id into v_inst2 from public.installments where sale_id = v_sale and number = 2;

  -- Parcela 1 vencida => cliente atrasado
  if (select status from public.v_installments where id = v_inst1) <> 'overdue' then raise exception 'FALHA: parcela 1 deveria estar atrasada'; end if;
  if (select financial_status from public.v_customers where id = v_cust) <> 'overdue' then raise exception 'FALHA: cliente deveria estar atrasado'; end if;
  passed := passed + 1;

  -- ---------- como FUNCIONÁRIO ----------
  perform set_config('request.jwt.claims', json_build_object('sub', v_emp, 'role', 'authenticated')::text, true);

  -- Funcionário NÃO cria cliente (RLS)
  begin
    insert into public.customers (full_name) values ('Hacker');
    raise exception 'FALHA: funcionário criou cliente';
  exception when insufficient_privilege then passed := passed + 1; end;

  -- Funcionário NÃO cria venda
  begin
    perform public.create_sale(jsonb_build_object('customer_id', v_cust, 'idempotency_key', gen_random_uuid()));
    raise exception 'FALHA: funcionário criou venda';
  exception when insufficient_privilege then passed := passed + 1; end;

  -- Funcionário NÃO escreve direto em pagamentos/parcelas
  begin
    update public.installments set paid_amount = amount where id = v_inst1;
    get diagnostics v_cnt = row_count;
    if v_cnt > 0 then raise exception 'FALHA: funcionário alterou parcela diretamente'; end if;
    passed := passed + 1;
  exception when insufficient_privilege then passed := passed + 1; end;

  begin
    delete from public.payments;
    get diagnostics v_cnt = row_count;
    if v_cnt > 0 then raise exception 'FALHA: funcionário apagou pagamentos'; end if;
    passed := passed + 1;
  exception when insufficient_privilege then passed := passed + 1; end;

  begin
    delete from public.activity_logs;
    get diagnostics v_cnt = row_count;
    if v_cnt > 0 then raise exception 'FALHA: apagou auditoria'; end if;
    passed := passed + 1;
  exception when insufficient_privilege then passed := passed + 1; end;

  -- Funcionário não altera o e-mail do próprio perfil (grant por coluna)
  begin
    update public.profiles set email = 'dono@falso.local' where id = v_emp;
    raise exception 'FALHA: funcionário alterou o próprio e-mail';
  exception when insufficient_privilege then passed := passed + 1; end;

  -- Agenda: autoria não pode ser falsificada; atendimento feito não é reaberto nem apagado
  begin
    insert into public.visits (city_id, visit_date, created_by) values (v_city, v_today + 1, v_owner);
    raise exception 'FALHA: funcionário criou visita em nome de outro usuário';
  exception when insufficient_privilege then passed := passed + 1; end;
  insert into public.visits (city_id, visit_date, created_by) values (v_city, v_today + 1, v_emp) returning id into v_id;
  begin
    update public.visits set city_id = city_id where id = v_id;
    raise exception 'FALHA: funcionário alterou a cidade da visita';
  exception when insufficient_privilege then passed := passed + 1; end;
  begin
    insert into public.visit_customers (visit_id, customer_id, status) values (v_id, v_cust2, 'visited');
    raise exception 'FALHA: inclusão direta já como atendido';
  exception when insufficient_privilege then passed := passed + 1; end;

  -- Reordenação de paradas: atômica e só com a lista exata da visita
  declare
    v_rv uuid; v_s1 uuid; v_s2 uuid;
  begin
    insert into public.visits (city_id, visit_date, created_by) values (v_city, v_today + 2, v_emp) returning id into v_rv;
    insert into public.visit_customers (visit_id, customer_id, stop_order) values (v_rv, v_cust, 1) returning id into v_s1;
    insert into public.visit_customers (visit_id, customer_id, stop_order) values (v_rv, v_cust2, 2) returning id into v_s2;
    perform public.reorder_visit_stops(v_rv, array[v_s2, v_s1]);
    if (select stop_order from public.visit_customers where id = v_s2) <> 1
       or (select stop_order from public.visit_customers where id = v_s1) <> 2 then
      raise exception 'FALHA: reorder_visit_stops não gravou a nova ordem';
    end if;
    begin
      perform public.reorder_visit_stops(v_rv, array[v_s1]);
      v_rv := null; -- não deveria chegar aqui
    exception when sqlstate 'P0001' then null; end;
    if v_rv is null then raise exception 'FALHA: reordenação aceitou lista incompleta'; end if;
    begin
      perform public.reorder_visit_stops(v_rv, array[v_s1, v_s1]);
      v_rv := null;
    exception when sqlstate 'P0001' then null; end;
    if v_rv is null then raise exception 'FALHA: reordenação aceitou lista com duplicadas'; end if;
    if (select stop_order from public.visit_customers where id = v_s2) <> 1 then
      raise exception 'FALHA: reordenação recusada alterou a ordem';
    end if;
    passed := passed + 1;
  end;

  insert into public.visit_customers (visit_id, customer_id, updated_by) values (v_id, v_cust, v_owner) returning id into v_id;
  if (select updated_by from public.visit_customers where id = v_id) <> v_emp then raise exception 'FALHA: updated_by falsificado'; end if;
  begin
    update public.visit_customers set notes = 'editado fora da RPC' where id = v_id;
    raise exception 'FALHA: funcionário editou atendimento fora da RPC';
  exception when insufficient_privilege then passed := passed + 1; end;
  perform public.set_visit_customer_status(v_id, 'visited', 'cliente atendido');
  begin
    perform public.set_visit_customer_status(v_id, 'to_visit', null);
    raise exception 'FALHA: funcionário reabriu atendimento';
  exception when sqlstate 'P0001' then passed := passed + 1; end;
  delete from public.visit_customers where id = v_id;
  if not exists (select 1 from public.visit_customers where id = v_id) then raise exception 'FALHA: funcionário apagou atendimento feito'; end if;
  passed := passed + 1;

  -- Funcionário não se promove
  begin
    update public.profiles set role = 'owner' where id = v_emp;
    raise exception 'FALHA: funcionário se promoveu';
  exception when insufficient_privilege then passed := passed + 1; end;

  -- Pagamento parcial (150 de 316.67), confirmado
  v_pay := public.register_payment(v_inst1, 150, v_today, 'cash', 'parcial', true, '22222222-2222-2222-2222-222222222222');
  select remaining into v_num from public.v_installments where id = v_inst1;
  if v_num <> 166.67 then raise exception 'FALHA: saldo parcial %', v_num; end if; passed := passed + 1;

  -- Duplo clique (mesma chave) não duplica
  if public.register_payment(v_inst1, 150, v_today, 'cash', 'parcial', true, '22222222-2222-2222-2222-222222222222') <> v_pay then
    raise exception 'FALHA: idempotência pagamento'; end if;
  select paid_amount into v_num from public.installments where id = v_inst1;
  if v_num <> 150 then raise exception 'FALHA: pagamento duplicado (%)', v_num; end if; passed := passed + 1;

  -- Baixa superior ao saldo é rejeitada
  begin
    perform public.register_payment(v_inst1, 200, v_today, 'cash', null, true, gen_random_uuid());
    raise exception 'FALHA: aceitou valor acima do saldo';
  exception when sqlstate 'P0001' then passed := passed + 1; end;

  -- Data futura rejeitada
  begin
    perform public.register_payment(v_inst1, 10, v_today + 1, 'cash', null, true, gen_random_uuid());
    raise exception 'FALHA: aceitou data futura';
  exception when sqlstate 'P0001' then passed := passed + 1; end;

  -- Pix com comprovante: registrado SEM confirmação => não baixa saldo
  v_pay2 := public.register_payment(v_inst1, 166.67, v_today, 'pix', 'pix com comprovante', false, gen_random_uuid());
  select paid_amount into v_num from public.installments where id = v_inst1;
  if v_num <> 150 then raise exception 'FALHA: pagamento pendente baixou saldo'; end if;
  if (select pending_confirmation_amount from public.v_installments where id = v_inst1) <> 166.67 then raise exception 'FALHA: pendente não exibido'; end if;
  passed := passed + 1;

  -- Comprovante sem arquivo no Storage é recusado
  begin
    insert into public.payment_receipts (payment_id, storage_path, file_name, mime_type, size_bytes, uploaded_by)
    values (v_pay2, 'payments/' || v_pay2 || '/00000000-0000-0000-0000-000000000000.pdf', 'falso.pdf', 'application/pdf', 1, v_emp);
    raise exception 'FALHA: comprovante sem arquivo aceito';
  exception when insufficient_privilege then passed := passed + 1; end;

  -- Comprovante vinculado ao objeto enviado pelo próprio funcionário (simula o upload no Storage)
  perform set_config('role', 'postgres', true);
  insert into storage.objects (bucket_id, name, owner_id, metadata)
  values ('receipts', 'payments/' || v_pay2 || '/11111111-2222-3333-4444-555555555555.jpg', v_emp::text,
          jsonb_build_object('mimetype', 'image/jpeg', 'size', 12345));
  perform set_config('role', 'authenticated', true);
  -- tamanho divergente do arquivo real é recusado
  begin
    insert into public.payment_receipts (payment_id, storage_path, file_name, mime_type, size_bytes, uploaded_by)
    values (v_pay2, 'payments/' || v_pay2 || '/11111111-2222-3333-4444-555555555555.jpg', 'comprovante.jpg', 'image/jpeg', 99, v_emp);
    raise exception 'FALHA: comprovante com tamanho divergente aceito';
  exception when insufficient_privilege then passed := passed + 1; end;
  insert into public.payment_receipts (payment_id, storage_path, file_name, mime_type, size_bytes, uploaded_by)
  values (v_pay2, 'payments/' || v_pay2 || '/11111111-2222-3333-4444-555555555555.jpg', 'comprovante.jpg', 'image/jpeg', 12345, v_emp);
  passed := passed + 1;

  -- Enquanto há pendente, não aceita outro pagamento que ultrapasse o saldo
  begin
    perform public.register_payment(v_inst1, 10, v_today, 'cash', null, true, gen_random_uuid());
    raise exception 'FALHA: ignorou pagamento pendente na reserva de saldo';
  exception when sqlstate 'P0001' then passed := passed + 1; end;

  -- Confirmação => parcela quitada
  perform public.confirm_payment(v_pay2);
  if (select status from public.v_installments where id = v_inst1) <> 'paid' then raise exception 'FALHA: parcela 1 não quitada'; end if;
  if (select financial_status from public.v_customers where id = v_cust) = 'overdue' then raise exception 'FALHA: cliente ainda atrasado'; end if;
  passed := passed + 1;

  -- Adiamento: mantém vencimento original, muda data de cobrança, registra histórico
  v_id := public.postpone_installment(v_inst2, v_today + 30, 'Receberá salário', 'Cobrar no dia', 'pix', true);
  select count(*) into v_cnt from public.installments where id = v_inst2 and original_due_date = v_today + 20 and collection_date = v_today + 30 and needs_visit;
  if v_cnt <> 1 then raise exception 'FALHA: adiamento'; end if;
  if (select financial_status from public.v_customers where id = v_cust) <> 'postponed' then raise exception 'FALHA: status adiado'; end if;
  if not exists (select 1 from public.payment_postponements where installment_id = v_inst2 and previous_date = v_today + 20) then raise exception 'FALHA: histórico adiamento'; end if;
  passed := passed + 1;

  -- Adiar para o passado falha
  begin
    perform public.postpone_installment(v_inst2, v_today - 1, 'motivo', null, null, false);
    raise exception 'FALHA: adiou para o passado';
  exception when sqlstate 'P0001' then passed := passed + 1; end;

  -- Promessa ligada à parcela não pode passar do saldo da parcela
  begin
    perform public.create_promise(v_cust, v_inst2, 400, v_today, 'pix', null);
    raise exception 'FALHA: promessa maior que o saldo da parcela';
  exception when sqlstate 'P0001' then passed := passed + 1; end;

  -- Promessa não é pagamento
  v_promise := public.create_promise(v_cust, v_inst2, 100, v_today, 'pix', 'prometeu');
  select paid_amount into v_num from public.installments where id = v_inst2;
  if v_num <> 0 then raise exception 'FALHA: promessa baixou saldo'; end if;
  passed := passed + 1;

  -- Funcionário não estorna
  begin
    perform public.reverse_payment(v_pay, 'teste de estorno');
    raise exception 'FALHA: funcionário estornou';
  exception when insufficient_privilege then passed := passed + 1; end;

  -- Funcionário não faz ajuste de caixa
  begin
    perform public.cash_adjustment(10, 'cash', v_today, 'ajuste indevido');
    raise exception 'FALHA: funcionário ajustou caixa';
  exception when insufficient_privilege then passed := passed + 1; end;

  -- Observação de funcionário OK
  insert into public.customer_notes (customer_id, kind, body, created_by) values (v_cust, 'collection', 'Cobrança feita por telefone', v_emp);
  passed := passed + 1;

  -- Pagamento que cumpre a promessa (100 na parcela 2) => promessa kept
  perform public.register_payment(v_inst2, 100, v_today, 'pix', null, true, gen_random_uuid());
  if (select status from public.payment_promises where id = v_promise) <> 'kept' then raise exception 'FALHA: promessa não marcada como cumprida'; end if;
  select id into v_pay2 from public.payments where installment_id = v_inst2 and status = 'confirmed' and amount = 100;
  if not exists (select 1 from public.promise_allocations where promise_id = v_promise and payment_id = v_pay2 and amount = 100) then
    raise exception 'FALHA: alocação da promessa'; end if;
  passed := passed + 1;

  -- Funcionário registra em dinheiro sem confirmar; proprietário confirma => caixa fica com quem recebeu
  v_id := public.register_payment(v_inst2, 10, v_today, 'cash', 'recebido na rua', false, gen_random_uuid());

  -- ---------- de volta como PROPRIETÁRIO ----------
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  perform public.confirm_payment(v_id);
  if (select created_by from public.cash_movements where payment_id = v_id and kind = 'payment') <> v_emp then
    raise exception 'FALHA: movimento de caixa não atribuído a quem recebeu'; end if;
  if (select confirmed_by from public.payments where id = v_id) <> v_owner then raise exception 'FALHA: confirmed_by'; end if;
  passed := passed + 1;

  -- Estorno mantém registro original e reabre saldo
  perform public.reverse_payment(v_pay, 'Lançado em duplicidade');
  if (select status from public.payments where id = v_pay) <> 'reversed' then raise exception 'FALHA: status estorno'; end if;
  select remaining into v_num from public.v_installments where id = v_inst1;
  if v_num <> 150 then raise exception 'FALHA: saldo após estorno %', v_num; end if;
  if not exists (select 1 from public.cash_movements where payment_id = v_pay and kind = 'reversal' and amount = -150) then raise exception 'FALHA: movimento de estorno'; end if;
  passed := passed + 1;

  -- Caixa do dia: 100 (entrada pix) + 200 (à vista dinheiro) + 150 (dinheiro) + 166.67 (pix) + 100 (pix) + 10 (dinheiro) - 150 (estorno) = 576.67
  v_num := (public.cash_day_summary(v_today)->>'total')::numeric;
  if v_num - v_cash_base <> 576.67 then raise exception 'FALHA: caixa do dia % (base %)', v_num, v_cash_base; end if;
  passed := passed + 1;

  -- Cancelar venda com pagamentos ativos falha
  begin
    perform public.cancel_sale(v_sale, 'cliente desistiu');
    raise exception 'FALHA: cancelou venda com pagamentos';
  exception when sqlstate 'P0001' then passed := passed + 1; end;

  -- Estorno do pagamento que cumpriu a promessa reabre a promessa
  perform public.reverse_payment(v_pay2, 'Pix devolvido pelo banco');
  if (select status from public.payment_promises where id = v_promise) <> 'pending' then raise exception 'FALHA: promessa não reaberta no estorno'; end if;
  if exists (select 1 from public.promise_allocations where payment_id = v_pay2) then raise exception 'FALHA: alocação não removida no estorno'; end if;
  passed := passed + 1;

  -- days_overdue nunca negativo
  if exists (select 1 from public.v_installments where days_overdue < 0 or (status = 'overdue' and days_overdue < 1)) then
    raise exception 'FALHA: days_overdue inválido'; end if;
  passed := passed + 1;

  -- Dia conferido não recebe lançamentos
  if not exists (select 1 from public.cash_closings where closing_date = v_today) then
    perform public.close_cash_day(v_today, null, 'teste');
  end if;
  begin
    perform public.cash_adjustment(10, 'cash', v_today, 'ajuste após conferência');
    raise exception 'FALHA: ajuste em dia conferido';
  exception when sqlstate 'P0001' then passed := passed + 1; end;
  begin
    perform public.reverse_payment((select id from public.payments where sale_id = v_sale2 limit 1), 'estorno após conferência');
    raise exception 'FALHA: estorno com o caixa de hoje conferido';
  exception when sqlstate 'P0001' then passed := passed + 1; end;

  -- Relatório por cidade fecha com o resumo geral
  if (select coalesce(sum(total_pending), 0) from public.report_by_city(v_today - 30, v_today))
     <> (public.report_summary(v_today - 30, v_today)->>'total_pending')::numeric then
    raise exception 'FALHA: report_by_city não fecha com report_summary'; end if;
  passed := passed + 1;

  -- Linha do tempo do cliente contém venda, pagamentos, adiamento, promessa, observação
  select count(distinct action) into v_cnt from public.activity_logs where customer_id = v_cust
    and action in ('create', 'sale', 'payment', 'payment_partial', 'payment_pending', 'postponement', 'promise', 'note', 'receipt', 'payment_reversed');
  if v_cnt < 9 then raise exception 'FALHA: linha do tempo incompleta (% tipos)', v_cnt; end if;
  passed := passed + 1;

  -- Relatórios e notificações executam
  perform public.dashboard_summary(); perform public.report_summary(v_today - 30, v_today);
  perform * from public.report_by_city(v_today - 30, v_today); perform * from public.delinquency_aging();
  perform * from public.get_notifications(); perform * from public.monthly_series(6);
  perform * from public.customers_to_visit(v_city); perform * from public.global_search('joão');
  passed := passed + 1;

  -- ---------- Agregações (20261108100001_aggregates) conferidas contra as views ----------
  -- v_payments expõe a cidade atual do cliente
  if exists (select 1 from public.v_payments p join public.customers c on c.id = p.customer_id
             where p.city_id is distinct from c.city_id) then
    raise exception 'FALHA: v_payments.city_id difere da cidade do cliente'; end if;
  passed := passed + 1;

  -- Somente usuários autenticados executam as RPCs de agregação
  if has_function_privilege('anon', 'public.sales_totals(text, text, uuid, date, date)', 'execute')
     or has_function_privilege('anon', 'public.customers_open_balance(text, uuid, text, boolean)', 'execute')
     or has_function_privilege('anon', 'public.city_totals(uuid[])', 'execute')
     or has_function_privilege('anon', 'public.collections_overview(text, uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.collections_overview(text, uuid)', 'execute') then
    raise exception 'FALHA: permissões das RPCs de agregação'; end if;
  passed := passed + 1;

  -- sales_totals: por cidade, por código (#123), por nome, por status e período
  declare
    v_j jsonb; v_ref record; v_code bigint;
  begin
    select count(*) as n, coalesce(sum(total), 0) as t, coalesce(sum(paid_total), 0) as p, coalesce(sum(balance), 0) as b into v_ref
      from public.v_sales where city_id = v_city and status <> 'cancelled';
    v_j := public.sales_totals(null, null, v_city, null, null);
    if (v_j->>'count')::int <> v_ref.n or (v_j->>'total')::numeric <> v_ref.t or (v_j->>'paid')::numeric <> v_ref.p
       or (v_j->>'balance')::numeric <> v_ref.b or v_ref.n = 0 then
      raise exception 'FALHA: sales_totals por cidade % vs %', v_j, row_to_json(v_ref); end if;

    select code into v_code from public.sales where id = v_sale;
    v_j := public.sales_totals(' #' || v_code || ' ', null, null, null, null);
    if (v_j->>'count')::int <> 1 or (v_j->>'total')::numeric <> 1050 then raise exception 'FALHA: sales_totals por código %', v_j; end if;

    select count(*) as n, coalesce(sum(balance), 0) as b into v_ref
      from public.v_sales where customer_name ilike '%joão te%' and status <> 'cancelled';
    v_j := public.sales_totals('joão te', null, null, null, null);
    if (v_j->>'count')::int <> v_ref.n or (v_j->>'balance')::numeric <> v_ref.b or v_ref.n = 0 then
      raise exception 'FALHA: sales_totals por nome % vs %', v_j, row_to_json(v_ref); end if;
    -- '_' é literal (escapado) na busca por nome
    if (public.sales_totals('jo_o teste', null, null, null, null)->>'count')::int <> 0 then
      raise exception 'FALHA: sales_totals não escapou o curinga _'; end if;

    select count(*) as n into v_ref from public.v_sales
      where city_id = v_city and status = 'open' and sale_date between v_today - 1 and v_today;
    v_j := public.sales_totals(null, 'open', v_city, v_today - 1, v_today);
    if (v_j->>'count')::int <> v_ref.n then raise exception 'FALHA: sales_totals status/período %', v_j; end if;
    if (public.sales_totals(null, 'cancelled', null, null, null)->>'count')::int <> 0 then
      raise exception 'FALHA: sales_totals deve excluir canceladas'; end if;
  end;
  passed := passed + 1;

  -- customers_open_balance: cada situação financeira (todo o banco e por cidade) e busca por telefone
  declare
    v_j jsonb; v_ref record; v_st text;
  begin
    foreach v_st in array array['up_to_date', 'pending', 'overdue', 'postponed', 'paid_off', 'no_sales', null] loop
      select count(*) filter (where balance > 0) as n, coalesce(sum(balance) filter (where balance > 0), 0) as b into v_ref
        from public.v_customers where (v_st is null or financial_status = v_st);
      v_j := public.customers_open_balance(null, null, v_st, true);
      if (v_j->>'count')::int <> v_ref.n or (v_j->>'balance')::numeric <> v_ref.b then
        raise exception 'FALHA: customers_open_balance status % : % vs %', v_st, v_j, row_to_json(v_ref); end if;

      select count(*) filter (where balance > 0) as n, coalesce(sum(balance) filter (where balance > 0), 0) as b into v_ref
        from public.v_customers where city_id = v_city and archived_at is null and (v_st is null or financial_status = v_st);
      v_j := public.customers_open_balance('', v_city, v_st, false);
      if (v_j->>'count')::int <> v_ref.n or (v_j->>'balance')::numeric <> v_ref.b then
        raise exception 'FALHA: customers_open_balance cidade/status % : % vs %', v_st, v_j, row_to_json(v_ref); end if;
    end loop;

    select count(*) filter (where balance > 0) as n, coalesce(sum(balance) filter (where balance > 0), 0) as b into v_ref
      from public.v_customers where (phone ilike '%7499999%' or whatsapp ilike '%7499999%') and archived_at is null;
    v_j := public.customers_open_balance('(74) 99999', null, null, false);
    if (v_j->>'count')::int <> v_ref.n or (v_j->>'balance')::numeric <> v_ref.b or v_ref.n = 0 then
      raise exception 'FALHA: customers_open_balance por telefone % vs %', v_j, row_to_json(v_ref); end if;
    v_j := public.customers_open_balance('joão', v_city, null, false);
    if (v_j->>'count')::int <> 1 then raise exception 'FALHA: customers_open_balance por nome %', v_j; end if;
  end;
  passed := passed + 1;

  -- city_totals: igual a v_installments/customers e ao report_by_city (cidade ativa); id sem dados => zeros
  declare
    v_ct record; v_ref record; v_rep record; v_ghost uuid := gen_random_uuid();
  begin
    select * into v_ct from public.city_totals(array[v_city, v_city, v_ghost]) where city_id = v_city;
    select coalesce(sum(remaining), 0) as pending,
           coalesce(sum(remaining) filter (where status = 'overdue'), 0) as overdue,
           count(distinct customer_id) filter (where status = 'overdue') as oc into v_ref
      from public.v_installments where city_id = v_city and status not in ('paid', 'cancelled');
    select * into v_rep from public.report_by_city(v_today - 30, v_today) r where r.city_id = v_city;
    if v_ct.pending <> v_ref.pending or v_ct.overdue <> v_ref.overdue or v_ct.overdue_customers <> v_ref.oc
       or v_ct.customers_count <> (select count(*) from public.customers where city_id = v_city and archived_at is null)
       or v_ct.pending <> v_rep.total_pending or v_ct.overdue <> v_rep.total_overdue
       or v_ct.customers_count <> v_rep.customers_count or v_ct.overdue_customers <> v_rep.overdue_customers then
      raise exception 'FALHA: city_totals % vs % / %', row_to_json(v_ct), row_to_json(v_ref), row_to_json(v_rep); end if;
    if (select count(*) from public.city_totals(array[v_city, v_city, v_ghost])) <> 2
       or exists (select 1 from public.city_totals(array[v_ghost]) where customers_count <> 0 or pending <> 0 or overdue <> 0) then
      raise exception 'FALHA: city_totals linhas por id'; end if;
  end;
  passed := passed + 1;

  -- collections_overview: cada aba igual às consultas da central (v_installments / v_payments)
  declare
    v_j jsonb; v_tab text; v_n bigint; v_s numeric; v_q text;
  begin
    foreach v_q in array array[null, 'teste', '74 9999-9000'] loop
      v_j := public.collections_overview(v_q, v_city);
      foreach v_tab in array array['todas', 'hoje', 'proximas', 'atrasadas', 'adiadas', 'pagas'] loop
        select count(*), coalesce(sum(case when v_tab = 'pagas' then amount else remaining end), 0) into v_n, v_s
          from public.v_installments
          where city_id = v_city
            and (v_q is null or customer_name ilike '%' || v_q || '%'
                 or (v_q = '74 9999-9000' and (customer_phone ilike '%7%4%9%9%9%9%9%0%0%0%' or customer_whatsapp ilike '%7%4%9%9%9%9%9%0%0%0%')))
            and case v_tab
              when 'hoje' then status = 'due_today'
              when 'proximas' then status in ('upcoming', 'postponed') and collection_date > v_today
              when 'atrasadas' then status = 'overdue'
              when 'adiadas' then is_postponed and status not in ('paid', 'cancelled')
              when 'pagas' then status = 'paid'
              else status not in ('paid', 'cancelled') end;
        if (v_j->v_tab->>'count')::bigint <> v_n or (v_j->v_tab->>'sum')::numeric <> v_s then
          raise exception 'FALHA: collections_overview % (q=%) % vs %/%', v_tab, v_q, v_j->v_tab, v_n, v_s; end if;
      end loop;
      select count(*), coalesce(sum(amount), 0) into v_n, v_s from public.v_payments
        where status = 'pending_confirmation' and city_id = v_city and (v_q is null or customer_name ilike '%' || v_q || '%');
      if (v_j->'confirmar'->>'count')::bigint <> v_n or (v_j->'confirmar'->>'sum')::numeric <> v_s then
        raise exception 'FALHA: collections_overview confirmar (q=%) % vs %/%', v_q, v_j->'confirmar', v_n, v_s; end if;
    end loop;
    if (public.collections_overview(null, v_city)->'todas'->>'count')::int = 0
       or (public.collections_overview('74 9999-9000', v_city)->'todas'->>'count')::int = 0 then
      raise exception 'FALHA: collections_overview sem parcelas no cenário de teste'; end if;
  end;
  passed := passed + 1;

  raise exception 'TESTES_OK: % verificações passaram (transação desfeita)', passed;
end
$test$;
