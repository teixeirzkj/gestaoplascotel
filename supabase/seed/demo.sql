-- =============================================================================
-- PLASCOTEL — DADOS DE DEMONSTRAÇÃO (somente desenvolvimento / apresentação)
--
-- NÃO execute em produção com dados reais. Use: ALLOW_DEMO_SEED=true npm run seed:demo
-- (o script scripts/seed-demo.mjs executa este arquivo e sobe o comprovante Pix demo ao Storage).
--
-- Como funciona
--   * Todas as datas são RELATIVAS a public.app_today() (fuso America/Bahia), então os
--     cenários (atrasos de 5/12/25/40 dias, cobrança de hoje, visita de amanhã...) sempre fazem sentido.
--   * O bloco DO simula os usuários demo (proprietário e funcionário) via request.jwt.claims +
--     role authenticated. Assim as RPCs reais (create_sale, register_payment, postpone_installment,
--     create_promise, cash_adjustment, close_cash_day...) validam papéis, aplicam as regras e gravam auditoria.
--   * Ao final, já como postgres, alguns carimbos de data/hora são retroagidos APENAS para o demo
--     (created_at de vendas/pagamentos, horário dos registros de auditoria e uma promessa vencida),
--     para que linhas do tempo e gráficos fiquem coerentes. Isso nunca é feito pelo sistema em uso real.
--   * Aborta se já existirem clientes cadastrados (proteção contra duplicidade).
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Funções auxiliares temporárias (existem só nesta sessão)
-- -----------------------------------------------------------------------------
create function pg_temp.demo_act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- Item de venda a partir do nome do produto (preço de tabela)
create function pg_temp.demo_item(p_name text, p_qty numeric default 1) returns jsonb language sql stable as $$
  select jsonb_build_object('product_id', id, 'description', name, 'quantity', p_qty, 'unit_price', price)
  from public.products where name = p_name
$$;

-- Venda via RPC create_sale. Datas em dias relativos a hoje; parcelas iguais (resto na última).
create function pg_temp.demo_sale(
  p_customer uuid, p_sale_offset int, p_items jsonb, p_down numeric, p_down_method text,
  p_dues int[], p_discount numeric default 0, p_notes text default null, p_conditions text default null
) returns uuid language plpgsql as $$
declare
  v_sub numeric(12,2); v_rest numeric(12,2); v_base numeric(12,2); v_amt numeric(12,2);
  v_n int := coalesce(array_length(p_dues, 1), 0); v_inst jsonb := '[]'::jsonb; k int;
begin
  if exists (select 1 from jsonb_array_elements(p_items) e where e = 'null'::jsonb) then
    raise exception 'Produto de demonstração não encontrado';
  end if;
  select coalesce(sum(round((e->>'quantity')::numeric * (e->>'unit_price')::numeric, 2)), 0)
    into v_sub from jsonb_array_elements(p_items) e;
  v_rest := v_sub - p_discount - p_down;
  if v_n > 0 then
    v_base := trunc(v_rest / v_n, 2);
    for k in 1..v_n loop
      v_amt := case when k = v_n then v_rest - v_base * (v_n - 1) else v_base end;
      v_inst := v_inst || jsonb_build_array(jsonb_build_object('amount', v_amt, 'due_date', public.app_today() + p_dues[k]));
    end loop;
  elsif v_rest <> 0 then
    raise exception 'Venda à vista de demonstração com saldo %', v_rest;
  end if;
  return public.create_sale(jsonb_build_object(
    'customer_id', p_customer,
    'sale_date', public.app_today() + p_sale_offset,
    'discount', p_discount,
    'down_payment', p_down,
    'down_payment_received', p_down > 0,
    'down_payment_method', p_down_method,
    'payment_method', coalesce(p_down_method, 'cash'),
    'conditions', coalesce(p_conditions, case when v_n = 0 then 'À vista' else
      case when p_down > 0 then 'Entrada + ' else '' end || v_n || 'x mensais' end),
    'notes', p_notes,
    'idempotency_key', gen_random_uuid(),
    'items', p_items,
    'installments', v_inst));
end $$;

create function pg_temp.demo_inst(p_sale uuid, p_number int) returns uuid language sql stable as $$
  select id from public.installments where sale_id = p_sale and number = p_number
$$;

-- Pagamento via RPC register_payment (valor nulo = saldo da parcela)
create function pg_temp.demo_pay(
  p_sale uuid, p_number int, p_paid_offset int, p_method public.payment_method,
  p_amount numeric default null, p_confirm boolean default true, p_notes text default null
) returns uuid language plpgsql as $$
declare i public.installments%rowtype;
begin
  select * into i from public.installments where sale_id = p_sale and number = p_number;
  if i.id is null then raise exception 'Parcela % de demonstração não encontrada', p_number; end if;
  return public.register_payment(i.id, coalesce(p_amount, i.amount - i.paid_amount), public.app_today() + p_paid_offset,
    p_method, p_notes, p_confirm, gen_random_uuid());
end $$;

-- -----------------------------------------------------------------------------
-- Carga
-- -----------------------------------------------------------------------------
do $seed$
declare
  t date := public.app_today();
  v_owner uuid; v_emp uuid;
  -- cidades
  ci_jac uuid; ci_mc uuid; ci_ser uuid; ci_vn uuid; ci_mai uuid; ci_cg uuid; ci_sau uuid; ci_cae uuid;
  -- clientes
  c1 uuid; c2 uuid; c3 uuid; c4 uuid; c5 uuid; c6 uuid; c7 uuid; c8 uuid; c9 uuid;
  c10 uuid; c11 uuid; c12 uuid; c13 uuid; c14 uuid; c15 uuid; c16 uuid; c17 uuid; c18 uuid;
  -- vendas
  s_valdemar uuid; s_joselito_a uuid; s_jose uuid; s_adriana uuid; s_marlene uuid; s_gilberto uuid;
  s_rosangela uuid; s_cleonice_a uuid; s_antonia uuid; s_edvaldo uuid; s_francisca uuid; s_raimundo uuid;
  s_luciana uuid; s_terezinha uuid; s_domingos uuid; s_ivonete uuid; s_maria uuid; s_joselito_b uuid; s_cleonice_b uuid;
  -- outros
  v_visit uuid; v_promise_broken uuid; v_counted numeric(12,2);
begin
  -- ---------- pré-condições (como postgres) ----------
  if exists (select 1 from public.customers) then
    raise exception 'Seed de demonstração abortado: já existem clientes cadastrados. Rode "npm run reset:demo" antes (apaga TODOS os dados de negócio) ou não use o seed neste banco.';
  end if;
  select id into v_owner from public.profiles where email = 'proprietario.demo@plascotel.app' and role = 'owner' and active;
  select id into v_emp from public.profiles where email = 'funcionario.demo@plascotel.app' and active;
  if v_owner is null then
    raise exception 'Usuário proprietario.demo@plascotel.app (proprietário ativo) não encontrado. Crie os usuários demo antes (veja docs/SETUP.md).';
  end if;
  if v_emp is null then
    raise exception 'Usuário funcionario.demo@plascotel.app (ativo) não encontrado. Crie os usuários demo antes (veja docs/SETUP.md).';
  end if;

  -- =========================================================================
  -- PROPRIETÁRIO: cadastros
  -- =========================================================================
  perform pg_temp.demo_act_as(v_owner);

  insert into public.cities (name, state, notes, created_by) values ('Jacobina', 'BA', 'Base da loja. Rota semanal às segundas.', v_owner) returning id into ci_jac;
  insert into public.cities (name, state, notes, created_by) values ('Miguel Calmon', 'BA', 'Rota quinzenal. Sair cedo: estrada com obras.', v_owner) returning id into ci_mc;
  insert into public.cities (name, state, notes, created_by) values ('Serrolândia', 'BA', null, v_owner) returning id into ci_ser;
  insert into public.cities (name, state, notes, created_by) values ('Várzea Nova', 'BA', null, v_owner) returning id into ci_vn;
  insert into public.cities (name, state, notes, created_by) values ('Mairi', 'BA', 'Clientes concentrados no Centro.', v_owner) returning id into ci_mai;
  insert into public.cities (name, state, notes, created_by) values ('Capim Grosso', 'BA', null, v_owner) returning id into ci_cg;
  insert into public.cities (name, state, notes, created_by) values ('Saúde', 'BA', null, v_owner) returning id into ci_sau;
  insert into public.cities (name, state, notes, created_by) values ('Caém', 'BA', 'Visitar junto com Saúde (mesma rota).', v_owner) returning id into ci_cae;

  insert into public.products (name, category, price, description, created_by) values
    ('Cama Box Casal', 'Camas', 1290.00, 'Base box casal 138x188 com baú', v_owner),
    ('Cama Box Solteiro', 'Camas', 790.00, 'Base box solteiro 88x188', v_owner),
    ('Cama Box Queen', 'Camas', 1890.00, 'Base box queen 158x198', v_owner),
    ('Colchão Solteiro D33', 'Colchões', 489.90, 'Espuma D33, 88x188x17', v_owner),
    ('Colchão Casal D33', 'Colchões', 899.00, 'Espuma D33, 138x188x20', v_owner),
    ('Colchão Casal Molas Ensacadas', 'Colchões', 1590.00, 'Molas ensacadas com pillow top', v_owner),
    ('Sofá 3 lugares', 'Estofados', 2190.00, 'Suede marrom, assento retrátil', v_owner),
    ('Poltrona Decorativa', 'Estofados', 690.00, null, v_owner),
    ('Jogo de Lençol Casal', 'Cama/Mesa/Banho', 129.90, '4 peças, 150 fios', v_owner),
    ('Edredom Queen', 'Cama/Mesa/Banho', 249.90, 'Dupla face', v_owner),
    ('Travesseiro Fibra', 'Cama/Mesa/Banho', 39.90, '50x70', v_owner),
    ('Jogo de Toalhas 5 peças', 'Cama/Mesa/Banho', 119.90, null, v_owner),
    ('Guarda-roupa 6 portas', 'Móveis', 1490.00, 'MDP, com espelho', v_owner),
    ('Cômoda 4 gavetas', 'Móveis', 590.00, null, v_owner),
    ('Mesa com 4 cadeiras', 'Móveis', 1290.00, 'Tampo de vidro', v_owner),
    ('Rack para TV', 'Móveis', 450.00, 'Até 55 polegadas', v_owner),
    ('Ventilador de Coluna', 'Utilidades', 249.90, '40 cm, 3 velocidades', v_owner),
    ('Panela de Pressão 4,5L', 'Utilidades', 159.90, null, v_owner),
    ('Jogo de Panelas 5 peças', 'Utilidades', 389.90, 'Antiaderente', v_owner),
    ('Tapete de Sala 2x1,5m', 'Utilidades', 199.90, null, v_owner);
  insert into public.products (name, category, price, description, active, created_by)
    values ('Colchão Solteiro D20', 'Colchões', 329.90, 'Linha descontinuada', false, v_owner);

  -- Clientes (telefones fictícios, apenas dígitos)
  insert into public.customers (full_name, phone, whatsapp, city_id, neighborhood, address, reference, notes, created_by)
  values ('Maria das Graças Oliveira', '74991000101', '74991000101', ci_jac, 'Leader', 'Rua do Rosário, 112', 'Casa azul ao lado da padaria', 'Indicada pela Dona Cleonice.', v_owner) returning id into c1;
  insert into public.customers (full_name, phone, whatsapp, city_id, neighborhood, address, reference, created_by)
  values ('José Carlos Santos', '74991000102', '74991000102', ci_jac, 'Mundo Novo', 'Travessa São Benedito, 45', 'Em frente à igreja', v_owner) returning id into c2;
  insert into public.customers (full_name, phone, whatsapp, city_id, neighborhood, address, reference, created_by)
  values ('Antônia Ferreira Lima', '74991000103', '74991000103', ci_mc, 'Centro', 'Rua Rui Barbosa, 230', 'Próximo ao mercado municipal', v_owner) returning id into c3;
  insert into public.customers (full_name, phone, whatsapp, city_id, neighborhood, address, reference, created_by)
  values ('Raimundo Nonato Souza', '74991000104', '74991000104', ci_mc, 'Alto do Cruzeiro', 'Rua Nova, 18', 'Portão verde, depois do campo', v_owner) returning id into c4;
  insert into public.customers (full_name, phone, whatsapp, city_id, neighborhood, address, reference, created_by)
  values ('Francisca Alves Pereira', '74991000105', '74991000105', ci_ser, 'Centro', 'Rua Sete de Setembro, 501', 'Ao lado da farmácia', v_owner) returning id into c5;
  insert into public.customers (full_name, phone, whatsapp, city_id, neighborhood, address, reference, created_by)
  values ('Edvaldo Rocha Silva', '74991000106', '74991000106', ci_vn, 'Centro', 'Rua da Feira, 33', 'Barbearia do Edvaldo', v_owner) returning id into c6;
  insert into public.customers (full_name, phone, whatsapp, city_id, neighborhood, address, reference, created_by)
  values ('Luciana Barbosa Costa', '74991000107', '74991000107', ci_cg, 'Tancredo Neves', 'Rua Bahia, 77', 'Esquina com a escola municipal', v_owner) returning id into c7;
  insert into public.customers (full_name, phone, whatsapp, city_id, neighborhood, address, reference, created_by)
  values ('Joselito Batista Moura', '74991000108', '74991000118', ci_jac, 'Caeira', 'Rua Projetada B, 9', 'Casa de muro amarelo', v_owner) returning id into c8;
  insert into public.customers (full_name, phone, whatsapp, city_id, neighborhood, address, reference, created_by)
  values ('Cleonice Araújo Matos', '74991000109', '74991000109', ci_mai, 'Centro', 'Praça da Matriz, 14', 'Loja de confecções', v_owner) returning id into c9;
  insert into public.customers (full_name, phone, whatsapp, city_id, neighborhood, address, reference, created_by)
  values ('Valdemar Pinto Cardoso', '74991000110', null, ci_sau, 'Centro', 'Rua Coronel Souza, 120', 'Próximo à rodoviária', v_owner) returning id into c10;
  insert into public.customers (full_name, phone, whatsapp, city_id, neighborhood, address, reference, created_by)
  values ('Rosângela Dias Nascimento', '74991000111', '74991000111', ci_cae, 'Centro', 'Rua São José, 61', 'Atrás do posto de saúde', v_owner) returning id into c11;
  insert into public.customers (full_name, phone, whatsapp, city_id, neighborhood, address, reference, notes, created_by)
  values ('Gilberto Mendes Reis', '74991000112', '74991000112', ci_jac, 'Grotinha', 'Rua da Grota, 210', 'Subida depois do bar do Zé', 'Esposa: Dona Lúcia (mesmo telefone).', v_owner) returning id into c12;
  insert into public.customers (full_name, phone, whatsapp, city_id, neighborhood, address, reference, created_by)
  values ('Ivonete Gomes Cruz', '74991000113', '74991000113', ci_cg, 'Centro', 'Avenida Brasil, 402', 'Em cima da loja de celulares', v_owner) returning id into c13;
  insert into public.customers (full_name, phone, whatsapp, city_id, neighborhood, address, reference, created_by)
  values ('Domingos Teixeira Neto', '74991000114', '74991000114', ci_vn, 'Rodagem', 'Rua do Cemitério, 8', 'Última casa da rua', v_owner) returning id into c14;
  insert into public.customers (full_name, phone, whatsapp, city_id, neighborhood, address, reference, created_by)
  values ('Marlene Cavalcante Brito', '74991000115', '74991000115', ci_mai, 'Centro', 'Rua J. J. Seabra, 75', 'Casa com varanda grande', v_owner) returning id into c15;
  insert into public.customers (full_name, phone, whatsapp, city_id, neighborhood, address, reference, created_by)
  values ('Sebastião Lopes Ribeiro', '74991000116', '74991000116', ci_mc, 'Centro', 'Rua do Comércio, 19', 'Oficina de bicicletas', v_owner) returning id into c16;
  insert into public.customers (full_name, phone, whatsapp, city_id, neighborhood, address, reference, created_by)
  values ('Terezinha Moreira Freitas', '74991000117', '74991000117', ci_ser, 'Alto da Boa Vista', 'Rua Boa Vista, 300', 'Casa verde com jardim', v_owner) returning id into c17;
  insert into public.customers (full_name, phone, whatsapp, city_id, neighborhood, address, reference, created_by)
  values ('Adriana Souza Campos', '74991000119', '74991000119', ci_sau, 'Bela Vista', 'Rua das Flores, 56', 'Perto da quadra', v_owner) returning id into c18;

  -- =========================================================================
  -- PROPRIETÁRIO: vendas distribuídas nos últimos ~6 meses
  -- (offset da venda, itens, entrada, forma da entrada, vencimentos em dias relativos a hoje)
  -- =========================================================================
  -- Valdemar: venda QUITADA (todas as parcelas pagas)
  s_valdemar := pg_temp.demo_sale(c10, -158, jsonb_build_array(pg_temp.demo_item('Colchão Casal D33'), pg_temp.demo_item('Travesseiro Fibra', 2)),
    178.80, 'cash', array[-128, -98, -68]);
  -- Joselito: venda A antiga (parte paga) + venda B recente => DUAS VENDAS ABERTAS
  s_joselito_a := pg_temp.demo_sale(c8, -150, jsonb_build_array(pg_temp.demo_item('Sofá 3 lugares')),
    390.00, 'cash', array[-118, -88, -58, -28, 2, 32]);
  -- José: ATRASADO (parcelas vencidas há 40 e 12 dias)
  s_jose := pg_temp.demo_sale(c2, -130, jsonb_build_array(pg_temp.demo_item('Cama Box Casal'), pg_temp.demo_item('Jogo de Lençol Casal')),
    169.90, 'cash', array[-100, -70, -40, -12, 18]);
  -- Adriana: atrasada 8 dias, com desconto na venda
  s_adriana := pg_temp.demo_sale(c18, -125, jsonb_build_array(pg_temp.demo_item('Guarda-roupa 6 portas'), pg_temp.demo_item('Cômoda 4 gavetas')),
    400.00, 'pix', array[-95, -65, -35, -8, 22], 80.00, 'Desconto de R$ 80,00 negociado na entrega.');
  -- Marlene: em dia (pagou a 2ª parcela ontem)
  s_marlene := pg_temp.demo_sale(c15, -90, jsonb_build_array(pg_temp.demo_item('Mesa com 4 cadeiras')),
    290.00, 'cash', array[-60, -30, 30]);
  -- Gilberto: atrasado há 55 e 25 dias, sem pagamentos
  s_gilberto := pg_temp.demo_sale(c12, -80, jsonb_build_array(pg_temp.demo_item('Colchão Casal Molas Ensacadas')),
    190.00, 'cash', array[-55, -25, 5]);
  -- Rosângela: PROMESSA NÃO CUMPRIDA
  s_rosangela := pg_temp.demo_sale(c11, -75, jsonb_build_array(pg_temp.demo_item('Jogo de Panelas 5 peças'), pg_temp.demo_item('Jogo de Toalhas 5 peças'), pg_temp.demo_item('Edredom Queen')),
    159.70, 'pix', array[-46, -16, 14]);
  -- Cleonice: venda À VISTA quitada (com desconto)
  s_cleonice_a := pg_temp.demo_sale(c9, -60, jsonb_build_array(pg_temp.demo_item('Cômoda 4 gavetas'), pg_temp.demo_item('Tapete de Sala 2x1,5m')),
    780.00, 'cash', array[]::int[], 9.90);
  -- Antônia: atrasada 25 dias (será visitada amanhã)
  s_antonia := pg_temp.demo_sale(c3, -55, jsonb_build_array(pg_temp.demo_item('Cama Box Queen')),
    290.00, 'cash', array[-25, 5, 35, 65]);
  -- Edvaldo: PAGAMENTO PARCIAL na parcela que vence hoje
  s_edvaldo := pg_temp.demo_sale(c6, -45, jsonb_build_array(pg_temp.demo_item('Rack para TV'), pg_temp.demo_item('Ventilador de Coluna'), pg_temp.demo_item('Panela de Pressão 4,5L')),
    259.70, 'cash', array[-15, 0, 30]);
  -- Francisca: PAGAMENTO ADIADO ("Receberá salário", requer visita)
  s_francisca := pg_temp.demo_sale(c5, -40, jsonb_build_array(pg_temp.demo_item('Colchão Solteiro D33', 2), pg_temp.demo_item('Travesseiro Fibra', 2)),
    159.60, 'cash', array[-10, 20, 50]);
  -- Raimundo: atrasado 5 dias, com promessa para amanhã
  s_raimundo := pg_temp.demo_sale(c4, -35, jsonb_build_array(pg_temp.demo_item('Cama Box Solteiro'), pg_temp.demo_item('Colchão Solteiro D33')),
    179.90, 'cash', array[-5, 25, 55]);
  -- Luciana: COMPROVANTE PIX aguardando confirmação
  s_luciana := pg_temp.demo_sale(c7, -32, jsonb_build_array(pg_temp.demo_item('Jogo de Lençol Casal', 2), pg_temp.demo_item('Edredom Queen'), pg_temp.demo_item('Jogo de Toalhas 5 peças')),
    129.60, 'pix', array[-2, 28, 58]);
  -- Terezinha: em dia (pagou ontem via Pix)
  s_terezinha := pg_temp.demo_sale(c17, -31, jsonb_build_array(pg_temp.demo_item('Sofá 3 lugares')),
    390.00, 'pix', array[-1, 29, 59, 89]);
  -- Domingos: parcela vence HOJE
  s_domingos := pg_temp.demo_sale(c14, -30, jsonb_build_array(pg_temp.demo_item('Colchão Casal D33'), pg_temp.demo_item('Jogo de Lençol Casal')),
    128.90, 'cash', array[0, 30, 60]);
  -- Ivonete: vence em 2 dias (alerta "vence em breve")
  s_ivonete := pg_temp.demo_sale(c13, -28, jsonb_build_array(pg_temp.demo_item('Cama Box Casal')),
    190.00, 'pix', array[2, 32, 62, 92]);
  -- Maria: EM DIA (venda recente, só parcelas futuras)
  s_maria := pg_temp.demo_sale(c1, -5, jsonb_build_array(pg_temp.demo_item('Guarda-roupa 6 portas'), pg_temp.demo_item('Edredom Queen')),
    200.00, 'cash', array[25, 55, 85, 115, 145], 39.90);
  -- Joselito: venda B (sem entrada)
  s_joselito_b := pg_temp.demo_sale(c8, -3, jsonb_build_array(pg_temp.demo_item('Edredom Queen'), pg_temp.demo_item('Travesseiro Fibra', 4)),
    0, null, array[27, 57]);
  -- Cleonice: segunda compra, à vista hoje via Pix
  s_cleonice_b := pg_temp.demo_sale(c9, 0, jsonb_build_array(pg_temp.demo_item('Jogo de Lençol Casal'), pg_temp.demo_item('Travesseiro Fibra', 2)),
    209.70, 'pix', array[]::int[]);

  -- =========================================================================
  -- Pagamentos do PROPRIETÁRIO
  -- =========================================================================
  perform pg_temp.demo_pay(s_valdemar, 1, -128, 'cash');
  perform pg_temp.demo_pay(s_joselito_a, 1, -118, 'cash');
  perform pg_temp.demo_pay(s_joselito_a, 3, -58, 'pix');
  perform pg_temp.demo_pay(s_jose, 1, -98, 'cash', null, true, 'Pagou na loja');
  perform pg_temp.demo_pay(s_adriana, 1, -95, 'pix');
  perform pg_temp.demo_pay(s_adriana, 2, -63, 'pix');
  perform pg_temp.demo_pay(s_marlene, 1, -58, 'cash');
  perform pg_temp.demo_pay(s_marlene, 2, -1, 'cash', null, true, 'Pagou com atraso; combinado em ligação');

  -- =========================================================================
  -- Pagamentos do FUNCIONÁRIO (caixa por usuário)
  -- =========================================================================
  perform pg_temp.demo_act_as(v_emp);
  perform pg_temp.demo_pay(s_valdemar, 2, -97, 'pix');
  perform pg_temp.demo_pay(s_valdemar, 3, -68, 'pix');
  perform pg_temp.demo_pay(s_joselito_a, 2, -86, 'cash');
  perform pg_temp.demo_pay(s_joselito_a, 4, -6, 'cash', null, true, 'Recebido na visita a Jacobina');
  perform pg_temp.demo_pay(s_jose, 2, -68, 'cash');
  perform pg_temp.demo_pay(s_adriana, 3, -35, 'cash');
  perform pg_temp.demo_pay(s_rosangela, 1, -46, 'pix');
  perform pg_temp.demo_pay(s_edvaldo, 1, -15, 'cash');
  perform pg_temp.demo_pay(s_terezinha, 1, -1, 'pix');
  -- Parcial confirmado: R$ 120,00 de R$ 200,00 da parcela que vence hoje
  perform pg_temp.demo_pay(s_edvaldo, 2, 0, 'cash', 120.00, true, 'Pagamento parcial; restante combinado para a próxima semana');
  -- Pix NÃO confirmado (o comprovante é anexado pelo scripts/seed-demo.mjs)
  perform pg_temp.demo_pay(s_luciana, 1, 0, 'pix', null, false, 'Cliente enviou o comprovante do Pix pelo WhatsApp');

  -- Adiamento: "Receberá salário", com visita presencial
  perform public.postpone_installment(pg_temp.demo_inst(s_francisca, 1), t + 5, 'Receberá salário',
    'Pediu para passar na casa dela; paga em dinheiro.', 'cash', true);

  -- Promessa pendente (para amanhã, dia da visita)
  perform public.create_promise(c4, pg_temp.demo_inst(s_raimundo, 1), 366.66, t + 1, 'cash', 'Vai pagar na visita de amanhã.');
  -- Promessa que será retroagida para virar "não cumprida" (ver ajustes no final)
  v_promise_broken := public.create_promise(c11, pg_temp.demo_inst(s_rosangela, 2), 200.00, t, 'pix', 'Disse que faria o Pix assim que recebesse.');

  -- Observações de contato/cobrança (funcionário)
  insert into public.customer_notes (customer_id, kind, body, created_by) values
    (c2, 'collection', 'Liguei cobrando as parcelas em atraso. Disse que recebe o benefício no dia 15.', v_emp),
    (c3, 'collection', 'Cobrada por telefone. Pediu para passarmos na visita de Miguel Calmon.', v_emp),
    (c5, 'contact', 'Pediu para adiar: receberá o salário no início do mês. Prefere que a gente vá até a casa dela.', v_emp),
    (c11, 'collection', 'Promessa de R$ 200,00 não cumprida. Não atendeu as últimas duas ligações.', v_emp);

  -- =========================================================================
  -- Visitas
  -- =========================================================================
  -- Realizada há 6 dias em Jacobina (funcionário registrou o resultado)
  insert into public.visits (city_id, visit_date, visit_time, notes, created_by)
    values (ci_jac, t - 6, '08:00', 'Rota da segunda-feira: Mundo Novo, Grotinha e Caeira.', v_emp) returning id into v_visit;
  insert into public.visit_customers (visit_id, customer_id, stop_order, updated_by) values
    (v_visit, c2, 1, v_emp), (v_visit, c12, 2, v_emp), (v_visit, c8, 3, v_emp);
  perform public.set_visit_customer_status(id, 'visited', 'Pediu para voltar no dia 15, aguardando o benefício.') from public.visit_customers where visit_id = v_visit and customer_id = c2;
  perform public.set_visit_customer_status(id, 'not_found', 'Casa fechada; vizinha informou que está viajando.') from public.visit_customers where visit_id = v_visit and customer_id = c12;
  perform public.set_visit_customer_status(id, 'payment_received', 'Pagou a 4ª parcela em dinheiro.') from public.visit_customers where visit_id = v_visit and customer_id = c8;
  update public.visits set status = 'done' where id = v_visit;

  -- Amanhã em Miguel Calmon
  insert into public.visits (city_id, visit_date, visit_time, notes, created_by)
    values (ci_mc, t + 1, '08:30', 'Levar recibos e o catálogo novo de guarda-roupas.', v_emp) returning id into v_visit;
  insert into public.visit_customers (visit_id, customer_id, stop_order, updated_by) values
    (v_visit, c3, 1, v_emp), (v_visit, c4, 2, v_emp), (v_visit, c16, 3, v_emp);

  -- Em 5 dias em Serrolândia
  insert into public.visits (city_id, visit_date, visit_time, notes, created_by)
    values (ci_ser, t + 5, '09:00', 'Francisca pediu visita para pagar em dinheiro.', v_emp) returning id into v_visit;
  insert into public.visit_customers (visit_id, customer_id, stop_order, updated_by) values
    (v_visit, c5, 1, v_emp), (v_visit, c17, 2, v_emp);

  -- =========================================================================
  -- PROPRIETÁRIO: observações, ajuste e conferência do caixa de ontem
  -- =========================================================================
  perform pg_temp.demo_act_as(v_owner);
  insert into public.customer_notes (customer_id, kind, body, created_by) values
    (c12, 'contact', 'WhatsApp sem resposta há duas semanas. Tentar contato com a esposa (Dona Lúcia).', v_owner),
    (c16, 'note', 'Interessado em guarda-roupa 6 portas e cômoda. Levar orçamento na próxima visita.', v_owner),
    (c1, 'note', 'Prefere pagar em dinheiro, sempre no início do mês.', v_owner);

  perform public.cash_adjustment(50.00, 'cash', t - 1, 'Fundo de troco reposto no caixa');
  select coalesce(sum(amount), 0) into v_counted from public.cash_movements where occurred_on = t - 1 and method = 'cash';
  perform public.close_cash_day(t - 1, v_counted, 'Conferido sem divergências.');

  -- =========================================================================
  -- Ajustes SOMENTE PARA DEMO (como postgres): retroage carimbos de data/hora
  -- para que linhas do tempo e gráficos fiquem coerentes com as datas de negócio.
  -- =========================================================================
  perform set_config('role', 'postgres', true);

  -- Promessa de Rosângela: feita há 9 dias para 4 dias atrás => "não cumprida" (efetiva)
  update public.payment_promises
     set promised_on = t - 9, due_date = t - 4, created_at = ((t - 9) + time '16:20') at time zone 'America/Bahia'
   where id = v_promise_broken;
  update public.activity_logs
     set occurred_at = ((t - 9) + time '16:20') at time zone 'America/Bahia',
         summary = 'Promessa de pagamento de ' || public.fmt_brl(200) || ' para ' || public.fmt_date(t - 4) || ' via Pix',
         new_data = jsonb_build_object('amount', 200, 'due_date', t - 4)
   where entity_type = 'payment_promises' and entity_id = v_promise_broken;

  -- Vendas e pagamentos nas datas de negócio
  update public.sales set created_at = (sale_date + time '10:15') at time zone 'America/Bahia' where sale_date < t;
  update public.payments
     set created_at = (paid_on + time '14:30') at time zone 'America/Bahia',
         confirmed_at = case when confirmed_at is not null then (paid_on + time '14:35') at time zone 'America/Bahia' end
   where paid_on < t;
  update public.cash_movements m set created_at = p.confirmed_at from public.payments p where m.payment_id = p.id and p.paid_on < t;
  update public.cash_movements set created_at = ((t - 1) + time '17:40') at time zone 'America/Bahia' where kind = 'adjustment';
  update public.cash_closings set created_at = ((t - 1) + time '18:10') at time zone 'America/Bahia' where closing_date = t - 1;

  -- Auditoria correspondente
  update public.activity_logs a set occurred_at = s.created_at
    from public.sales s where a.entity_type = 'sales' and a.entity_id = s.id and a.action = 'sale';
  update public.activity_logs a set occurred_at = p.created_at + case when a.action like 'payment%' and a.action <> 'payment_pending' then interval '5 minutes' else interval '0' end
    from public.payments p where a.entity_type = 'payments' and a.entity_id = p.id;
  update public.activity_logs a set occurred_at = (i.paid_at + time '14:36') at time zone 'America/Bahia'
    from public.installments i where a.entity_type = 'installments' and a.entity_id = i.id and a.action = 'installment_paid';
  update public.activity_logs a set occurred_at = x.last_paid
    from (select sale_id, max(confirmed_at) + interval '2 minutes' as last_paid from public.payments where status = 'confirmed' group by sale_id) x
   where a.entity_type = 'sales' and a.entity_id = x.sale_id and a.action = 'sale_paid';
  update public.activity_logs a set occurred_at = c.created_at
    from public.cash_closings c where a.entity_type = 'cash_closings' and a.entity_id = c.id;
  update public.activity_logs a set occurred_at = m.created_at
    from public.cash_movements m where a.entity_type = 'cash_movements' and a.entity_id = m.id;

  -- Visita realizada: registros no dia da visita
  update public.activity_logs a set occurred_at = ((t - 6) + time '07:30') at time zone 'America/Bahia'
    from public.visits v where v.visit_date = t - 6 and a.entity_type = 'visits' and a.entity_id = v.id and a.action = 'create';
  update public.activity_logs a set occurred_at = ((t - 6) + time '07:31') at time zone 'America/Bahia'
    from public.visit_customers vc join public.visits v on v.id = vc.visit_id
   where v.visit_date = t - 6 and a.entity_type = 'visit_customers' and a.entity_id = vc.id and a.old_data is null;
  update public.activity_logs a set occurred_at = ((t - 6) + time '11:00') at time zone 'America/Bahia' + (vc.stop_order * interval '25 minutes')
    from public.visit_customers vc join public.visits v on v.id = vc.visit_id
   where v.visit_date = t - 6 and a.entity_type = 'visit_customers' and a.entity_id = vc.id and a.old_data is not null;
  update public.activity_logs a set occurred_at = ((t - 6) + time '12:40') at time zone 'America/Bahia'
    from public.visits v where v.visit_date = t - 6 and a.entity_type = 'visits' and a.entity_id = v.id and a.action = 'update';
  update public.visit_customers vc set updated_at = ((t - 6) + time '11:00') at time zone 'America/Bahia' + (vc.stop_order * interval '25 minutes')
    from public.visits v where v.id = vc.visit_id and v.visit_date = t - 6;

  -- Observações em datas recentes variadas
  update public.customer_notes set created_at = now() - interval '3 days' where customer_id in (c2, c3);
  update public.customer_notes set created_at = now() - interval '2 days' where customer_id in (c5, c12);
  update public.customer_notes set created_at = now() - interval '1 day' where customer_id in (c11, c16, c1);
  update public.activity_logs a set occurred_at = n.created_at
    from public.customer_notes n where a.entity_type = 'customer_notes' and a.entity_id = n.id;

  -- Cadastros "antigos": cidades/produtos há 6 meses; cada cliente no dia anterior à 1ª venda
  update public.activity_logs set occurred_at = now() - interval '180 days' where entity_type in ('cities', 'products') and action = 'create';
  update public.customers c
     set created_at = coalesce(((select min(s.sale_date) from public.sales s where s.customer_id = c.id) - 1 + time '09:00') at time zone 'America/Bahia',
                               now() - interval '10 days');
  update public.activity_logs a set occurred_at = c.created_at
    from public.customers c where a.entity_type = 'customers' and a.entity_id = c.id and a.action = 'create';
  -- O UPDATE acima gera "Dados do cliente alterados" (só created_at) no gatilho de auditoria; remove esse ruído do demo.
  delete from public.activity_logs
   where entity_type = 'customers' and action = 'update' and new_data ?& array['created_at']
     and (select count(*) from jsonb_object_keys(new_data)) = 1;
end
$seed$;

-- Remove as funções temporárias
drop function pg_temp.demo_pay(uuid, int, int, public.payment_method, numeric, boolean, text);
drop function pg_temp.demo_inst(uuid, int);
drop function pg_temp.demo_sale(uuid, int, jsonb, numeric, text, int[], numeric, text, text);
drop function pg_temp.demo_item(text, numeric);
drop function pg_temp.demo_act_as(uuid);

commit;

-- Resultado: pagamentos Pix aguardando confirmação sem comprovante (o seed-demo.mjs anexa um PDF a cada um)
select p.id as payment_id, p.created_by, p.amount, p.paid_on, c.full_name as customer_name
from public.payments p
join public.customers c on c.id = p.customer_id
where p.method = 'pix' and p.status = 'pending_confirmation'
  and not exists (select 1 from public.payment_receipts r where r.payment_id = p.id);
