# Segurança

Princípio central: **o navegador não é confiável.** A interface esconde botões conforme o papel, mas quem garante as regras é o banco: RLS, funções `SECURITY DEFINER` e gatilhos. Mesmo alguém que chame a API do Supabase diretamente com a chave publicável e um login válido só consegue o que o seu papel permite.

## 1. Autenticação

- O login é por e-mail e senha (Supabase Auth). O cadastro público deve ficar **desativado**: os usuários são criados pelo proprietário.
- A sessão fica em cookies HTTP-only (`@supabase/ssr`). O `src/proxy.ts` renova a sessão a cada navegação e redireciona para `/login` quem não está logado. As páginas e as Server Actions validam de novo no servidor (`requireUser`, `assertUser`, `assertOwner`).
- **Usuário desativado:** o perfil fica com `active = false`, o que corta o acesso a todos os dados porque toda política exige `is_active_user()`. Além disso, o login é banido no Auth. O sistema exige pelo menos um proprietário ativo.

## 2. Modelo de permissões

| Ação | Proprietário | Funcionário |
|---|:-:|:-:|
| Consultar clientes, vendas, parcelas, caixa, histórico | ✔ | ✔ |
| Criar/editar clientes, cidades e produtos | ✔ | — |
| Criar e cancelar vendas | ✔ | — |
| Registrar e confirmar pagamentos, anexar comprovantes | ✔ | ✔ |
| Rejeitar pagamento pendente | ✔ | só os que ele mesmo registrou |
| Estornar pagamento confirmado | ✔ | — |
| Adiar cobrança, registrar e resolver promessas | ✔ | ✔ |
| Registrar observações e visitas | ✔ | ✔ |
| Excluir visita | ✔ | — |
| Ajuste e conferência de caixa | ✔ | — |
| Relatórios, configurações e usuários | ✔ | — |

O papel fica em `public.profiles.role`. Funções auxiliares: `is_owner()`, `is_active_user()`, `current_role_name()`. Um gatilho (`guard_profile_update`) impede que um não-proprietário altere papel ou status, inclusive o próprio.

## 3. Row Level Security (RLS)

- **Todas** as tabelas de `public` têm RLS ativo. O papel `anon` não tem nenhum privilégio.
- **Leitura:** qualquer usuário autenticado e ativo.
- **Escrita direta**, só onde faz sentido e filtrada por política:
  - cadastros (`customers`, `cities`, `products`): só o proprietário. Não há DELETE: clientes são **arquivados**;
  - `visits` / `visit_customers`: usuários ativos (exclusão de visita só pelo proprietário);
  - `customer_notes` e `payment_receipts`: só INSERT, com `created_by`/`uploaded_by = auth.uid()`. Ninguém altera nem apaga;
  - `app_settings`: só o proprietário.
- **Tabelas financeiras** (`sales`, `sale_items`, `installments`, `payments`, `payment_postponements`, `payment_promises`, `cash_movements`, `cash_closings`) e `activity_logs`: **não há política de escrita**. Só as RPCs gravam nelas.

As views (`v_installments`, `v_customers`...) usam `security_invoker = true` e respeitam o RLS de quem consulta.

## 4. RPCs `SECURITY DEFINER`

Toda operação financeira passa por uma função no banco (`create_sale`, `register_payment`, `confirm_payment`, `reject_payment`, `reverse_payment`, `postpone_installment`, `create_promise`, `resolve_promise`, `cash_adjustment`, `close_cash_day`, `cancel_sale`, `set_visit_customer_status`). Cada uma:

1. **valida o papel** (`assert_active()` / `assert_owner()`);
2. **trava as linhas** envolvidas (`SELECT ... FOR UPDATE`), o que evita pagamentos duplicados em cliques simultâneos;
3. **valida os valores no servidor**: soma das parcelas igual ao total, pagamento até o saldo disponível, datas que não podem estar no futuro nem antes da venda, duas casas decimais;
4. aplica **idempotência** (`idempotency_key` em vendas e pagamentos), para que reenviar o formulário não duplique o lançamento;
5. **grava a auditoria**.

As funções usam `set search_path = public`, contra sequestro de `search_path`. As funções internas (`log_activity`, `_apply_payment_confirmation`...) têm o `EXECUTE` revogado de `authenticated`.

## 5. Storage privado de comprovantes

- O bucket `receipts` é **privado**, com limite de 10 MB e tipos permitidos JPEG, PNG, WEBP, HEIC e PDF.
- Caminho obrigatório: `payments/<payment_id>/<arquivo>`. O upload só é aceito se o pagamento existir e o usuário estiver ativo.
- Não há políticas de UPDATE nem DELETE: comprovantes **não podem ser substituídos nem apagados** pelo app.
- Os arquivos são abertos só por **URL assinada** de curta duração, gerada para um usuário autenticado. Nunca há URL pública.

## 6. Auditoria imutável

- `activity_logs` registra quem (`actor_id`), quando, o quê, a entidade, o cliente e o resumo em pt-BR, com os dados antes e depois (`old_data`/`new_data`) nas alterações.
- É alimentada **somente** por gatilhos e RPCs no banco. Nenhum usuário tem permissão de escrita, alteração ou exclusão nessa tabela.
- Cobre cadastros, vendas, pagamentos (registro, confirmação, rejeição, estorno), adiamentos, promessas, visitas, observações, comprovantes, caixa, configurações e usuários.

## 7. Estornos em vez de exclusões

Nada financeiro é apagado:

- um pagamento errado **pendente** é **rejeitado**, com motivo;
- um pagamento **confirmado** é **estornado** pelo proprietário, com justificativa de pelo menos 5 caracteres. Isso gera um movimento de caixa negativo e reabre a parcela;
- a venda é **cancelada** com motivo, e só depois de rejeitar ou estornar os pagamentos ativos. As parcelas ficam marcadas como canceladas;
- uma diferença de caixa vira **ajuste de caixa** com justificativa.

Assim, o caixa de qualquer dia passado sempre pode ser reconstruído e explicado.

## 8. Chaves e segredos

| Segredo | Onde fica | Risco se vazar |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | navegador (público por natureza) | Baixo: sem login, o acesso é nulo (RLS). |
| `SUPABASE_SECRET_KEY` | servidor (Vercel) e máquina local | **Alto**: ignora o RLS. |
| `SUPABASE_ACCESS_TOKEN` | **somente** a máquina de quem faz migrações | **Crítico**: administra todos os projetos da conta. |
| Senha do banco | gerenciador de senhas | **Crítico**. |

### Rotação de chaves

Faça a rotação **imediatamente** se houver suspeita de vazamento (chave commitada, notebook perdido, ex-colaborador com acesso), e de forma preventiva a cada 6 a 12 meses.

1. **Chave secreta:** Dashboard > Project Settings > API Keys > crie uma nova secret key. Atualize `SUPABASE_SECRET_KEY` na Vercel e no `.env.local` e faça o redeploy. Depois **revogue** a chave antiga.
2. **Chave publicável:** mesmo processo, atualizando `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e fazendo o redeploy.
3. **Access token:** Account > Access Tokens > revogue e gere outro, só para o `.env.local`.
4. **Senha do banco:** Project Settings > Database > Reset database password.
5. **JWT / sessões:** se houver suspeita de sessão comprometida, troque a senha do usuário (Configurações > Usuários > redefinir senha) ou desative-o.

Se uma chave foi commitada, considere-a comprometida **mesmo depois de apagar o commit**: faça a rotação.

## 9. Outras proteções

- Cabeçalhos HTTP em `next.config.ts`: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Strict-Transport-Security`, `Permissions-Policy`.
- `Content-Security-Policy` com nonce por requisição, gerada em `src/proxy.ts` (`script-src 'self' 'nonce-…' 'strict-dynamic'`; `connect-src`/`img-src` liberam só a origem do Supabase). O nonce exige renderização dinâmica, garantida por `await connection()` no layout raiz. Para implantar aos poucos, defina `CSP_REPORT_ONLY=1` e a política vai como `Content-Security-Policy-Report-Only`. Não mova a CSP para `next.config.ts`: sem nonce, seria preciso `'unsafe-inline'`.
- Redirecionamento pós-login (`?next=`) aceita só caminhos internos (`safeInternalPath` em `src/lib/safe-redirect.ts`): recusa `//host`, `/\host`, tab/CR/LF e qualquer destino de outra origem.
- `robots: noindex` — o sistema não deve aparecer em buscadores.
- Entradas validadas com Zod no servidor (Server Actions) e de novo no banco.
- Erros do banco traduzidos para mensagens amigáveis, sem detalhes internos para o usuário.
- Os scripts de demo exigem confirmação explícita (`ALLOW_DEMO_SEED`, `ALLOW_DEMO_RESET` + `--confirm=<ref>`) e o seed se recusa a rodar com `NODE_ENV=production`.

## 10. Checklist de segurança para produção

- [ ] Cadastro público desativado no Supabase Auth.
- [ ] Usuários demo desativados ou excluídos.
- [ ] `SUPABASE_ACCESS_TOKEN` **fora** da Vercel.
- [ ] `.env.local` fora do Git (`git log --all -- .env.local` não retorna nada).
- [ ] Site URL e Redirect URLs restritas aos domínios oficiais.
- [ ] Backups configurados e testados ([BACKUP.md](BACKUP.md)).
- [ ] Senha forte para cada usuário, uma conta por pessoa (nada de login compartilhado: a auditoria depende disso).

## Testes de invasão (novembro/2026)

Suítes automatizadas em `tests/security/` (rodar com `npm run test:security`):

| Suíte | Ambiente | O que o atacante tenta | Resultado |
|---|---|---|---|
| `anon-probe.mjs` | produção (somente leitura/tentativas negadas) | Sem login, só com a chave pública: ler todas as tabelas e views, gravar, chamar RPCs, listar/baixar/enviar comprovantes, criar conta, acessar páginas e exportações, redirecionamento aberto, segredos no JavaScript, cabeçalhos | 72/72 defesas OK |
| `employee-probe.mjs` | desenvolvimento | Com login de funcionário, chamando a API direto: virar proprietário, desativar o dono, criar/editar/excluir cadastros, dar baixa em parcela, alterar/apagar pagamentos, lançar no caixa, apagar/forjar auditoria, RPCs de proprietário, funções internas, falsificar autoria, comprovante sem arquivo, upload de HTML, injeção SQL | 42/42 defesas OK |
| `web-attacks.mjs` | desenvolvimento | XSS armazenado em cadastro/observações/histórico/busca, injeção em filtros de busca, CSRF em Server Actions, replay sem sessão, força bruta no login | 15/15 defesas OK |
| `supabase/tests/financial_rules.sql` | dev e produção (transação desfeita) | Regras financeiras e RLS no banco | 58/58 OK |

### Proteções adicionadas a partir dos testes
- **Força bruta:** 5 senhas erradas por e-mail ou 20 por IP em 15 minutos bloqueiam o login por até 15 minutos (`login_throttle_check`/`login_throttle_record`, só `service_role`; e-mail e IP guardados como hash SHA-256). Mensagem genérica de erro (não revela se o e-mail existe).
- **Senhas:** mínimo de 8 caracteres com letras e números (Supabase Auth e página Meu perfil); cadastro público desativado; rotação de refresh token.
- **Funções internas e de gatilho** não executáveis via `/rest/v1/rpc`; `search_path` fixo em todas as funções.
- **Redirecionamento:** `?next=` aceita só caminhos internos (recusa `//`, `/\`, URLs absolutas e controles/barras codificados).
- **Integridade do código:** `scripts/check-urls.mjs` roda antes de todo build e falha se o código citar domínios fora da lista aprovada (um link interno chegou a ser gravado apontando para um domínio externo desconhecido; foi corrigido).

### Pendências que dependem de plano pago
- Proteção contra senhas vazadas (HaveIBeenPwned) e PITR: Supabase Pro.
- Uso comercial na Vercel: plano Pro.
