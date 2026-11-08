# Configuração do ambiente

Guia para colocar o PLASCOTEL para rodar na sua máquina, ligado a um projeto Supabase, e para passar dos usuários de demonstração para os usuários reais.

## 1. Pré-requisitos

- Node.js 20.6 ou mais recente (testado com o Node 24) e npm.
- Uma conta no [Supabase](https://supabase.com) com um projeto criado. Recomenda-se a região **South America (São Paulo)**.
- Git.

## 2. Variáveis de ambiente

```bash
cp .env.example .env.local
```

Preencha o `.env.local`. Cada variável está explicada no próprio `.env.example`.

| Variável | Onde encontrar | Tipo |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Dashboard > Project Settings > API | pública |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Dashboard > Project Settings > API Keys (`sb_publishable_...`) | pública |
| `SUPABASE_SECRET_KEY` | Dashboard > Project Settings > API Keys (`sb_secret_...`) | **secreta** |
| `SUPABASE_ACCESS_TOKEN` | Dashboard > Account > Access Tokens | **secreta**, só na máquina local |
| `SUPABASE_PROJECT_REF` | O trecho antes de `.supabase.co` na URL | só na máquina local |
| `DEMO_OWNER` / `DEMO_EMPLOYEE` | Login dos usuários demo (`email senha`) | só desenvolvimento |

> O `.env.local` nunca vai para o Git. Não copie senhas nem chaves para documentos, tickets ou mensagens.

## 3. Instalar dependências

```bash
npm install
```

## 4. Aplicar as migrações do banco

As migrações ficam em `supabase/migrations/` e são aplicadas pela Management API, sem precisar da senha do banco:

```bash
npm run db:migrate        # = node scripts/db.mjs migrate
```

O script registra o que já foi aplicado em `supabase_migrations.schema_migrations` e só roda as migrações pendentes, cada uma em uma transação.

Para conferir as regras financeiras e de permissão (a suíte desfaz tudo ao final):

```bash
npm run db:test           # deve terminar com TESTES_OK
```

Consultas rápidas de diagnóstico (rodam como `postgres`; use só para leitura):

```bash
node scripts/db.mjs sql "select count(*) from customers"
```

## 5. Gerar os tipos do TypeScript

Sempre que o schema mudar:

```bash
npm run db:types          # gera src/types/supabase.ts (usa SUPABASE_ACCESS_TOKEN e SUPABASE_PROJECT_REF)
```

Os aliases de domínio (`InstallmentView`, `CustomerView`...) ficam em `src/types/database.ts`. Ajuste-os se as views mudarem.

## 6. Configurar o Auth do Supabase

Em **Authentication > Sign In / Providers**:

- Deixe **Email** habilitado (o login é por e-mail e senha).
- Desative **Allow new users to sign up**. Os usuários são criados pelo proprietário em **Configurações** (ou pelo Dashboard). Ninguém deve conseguir se cadastrar sozinho.

Em **Authentication > URL Configuration**:

- Local: Site URL `http://localhost:3000`.
- Produção: veja [DEPLOY_VERCEL.md](DEPLOY_VERCEL.md).

## 7. Rodar localmente

```bash
npm run dev               # http://localhost:3000
npm run typecheck         # checagem de tipos
npm run lint
```

No celular, na mesma rede Wi-Fi, abra `http://<ip-do-computador>:3000`. Para instalar na tela inicial, use HTTPS (o deploy na Vercel já tem): no Chrome do Android, toque em **Adicionar à tela inicial**; no Safari do iPhone, toque em **Compartilhar > Adicionar à Tela de Início**.

## 8. Usuários e papéis

| Papel | Pode |
|---|---|
| **Proprietário** (`owner`) | Tudo: cadastros, vendas e cancelamentos, estornos, ajustes e conferência de caixa, relatórios, configurações e usuários. |
| **Funcionário** (`employee`) | Consultar tudo, registrar e confirmar pagamentos, anexar comprovantes, adiar cobranças, registrar promessas, observações e visitas. |

### Primeiro usuário = proprietário

O gatilho `handle_new_user` cria um perfil para cada usuário do Auth. **O primeiro usuário criado num banco sem perfis vira proprietário.** Os seguintes entram como funcionário, a menos que sejam criados com `app_metadata.role = "owner"`, que é o que a tela **Configurações > Usuários** faz quando o papel escolhido é Proprietário.

Num projeto novo:

1. Aplique as migrações.
2. Em **Authentication > Users > Add user > Create new user**, informe o seu e-mail e uma senha forte, com **Auto Confirm User** marcado.
3. Entre no sistema com esse usuário. Ele já é o proprietário.
4. Crie os funcionários em **Configurações > Usuários**.

### Usuários de demonstração existentes

Este projeto já tem dois usuários de demonstração:

- `proprietario.demo@plascotel.app`: proprietário
- `funcionario.demo@plascotel.app`: funcionário

As senhas estão **somente** no `.env.local`, nas variáveis `DEMO_OWNER` e `DEMO_EMPLOYEE`.

## 9. Dados de demonstração

O banco começa vazio. Para apresentações e testes manuais, existe uma carga fictícia: 8 cidades da região de Jacobina/BA, 21 produtos, 18 clientes e cerca de 19 vendas distribuídas nos últimos 6 meses. Ela inclui atrasos em todas as faixas, cobrança adiada, pagamento parcial, Pix aguardando confirmação com comprovante, promessa não cumprida, visitas e caixa conferido.

```bash
# bash/zsh
ALLOW_DEMO_SEED=true npm run seed:demo
# PowerShell
$env:ALLOW_DEMO_SEED="true"; npm run seed:demo
```

- Precisa dos dois usuários demo ativos e de um banco **sem clientes**. Se já houver clientes, a carga é cancelada.
- Recusa rodar com `NODE_ENV=production`.
- Todas as datas são relativas ao dia de hoje (fuso America/Bahia), então os cenários sempre fazem sentido.
- As operações passam pelas RPCs reais, simulando o proprietário e o funcionário demo. Por isso a auditoria e o caixa por usuário ficam preenchidos.
- O comprovante Pix demo é um PDF fictício gerado pelo script e enviado ao bucket privado `receipts`.

## 10. Começar a usar de verdade

Faça isso uma única vez, antes de lançar dados reais.

1. **Faça um backup**, se houver algo a guardar (veja [BACKUP.md](BACKUP.md)).
2. **Apague os dados de demonstração.** O comando abaixo apaga todos os dados de negócio, incluindo os arquivos de comprovantes, e preserva usuários, papéis e configurações. Os códigos de venda voltam a começar do #1.
   ```bash
   # bash/zsh
   ALLOW_DEMO_RESET=true npm run reset:demo -- --confirm=<SUPABASE_PROJECT_REF>
   # PowerShell
   $env:ALLOW_DEMO_RESET="true"; npm run reset:demo -- --confirm=<SUPABASE_PROJECT_REF>
   ```
   Para manter as cidades e os produtos cadastrados, acrescente `--keep-catalog`.
   > **Irreversível.** Nunca rode este comando depois de começar a lançar dados reais.
3. **Crie o seu usuário proprietário real.** Entre como `proprietario.demo@plascotel.app`, abra **Configurações > Usuários** e crie o seu usuário com o papel **Proprietário**.
4. **Saia e entre com o usuário real.** Confira que o menu mostra as opções de proprietário.
5. **Desative os usuários demo.** Em **Configurações > Usuários**, desative `proprietario.demo` e `funcionario.demo`. A desativação bloqueia o login no Auth e o acesso no banco: o perfil fica inativo e todas as políticas exigem usuário ativo. Se preferir, exclua-os depois em **Authentication > Users** no Dashboard. Os registros de auditoria ficam preservados com o nome do autor.
6. **Remova `DEMO_OWNER` e `DEMO_EMPLOYEE`** do `.env.local`.
7. Preencha os dados da empresa (nome, telefone, chave Pix) e os prazos de cobrança em **Configurações**.
8. Cadastre os funcionários reais, as cidades, os produtos e os clientes.
