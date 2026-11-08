# Deploy na Vercel

Passo a passo para publicar o PLASCOTEL na Vercel, ligado ao projeto Supabase de produção.

## Antes de começar

- As migrações já devem estar aplicadas no projeto Supabase de produção: `npm run db:migrate`, rodado **da sua máquina** (veja [SETUP.md](SETUP.md)). A Vercel não aplica migrações.
- Rode `npm run typecheck`, `npm run lint` e `npm run build` localmente para pegar erros antes do deploy.
- Se o banco recebeu dados de demonstração, limpe-o antes de usar de verdade. Veja **SETUP.md, seção 10**.

## 1. Importar o repositório

1. Envie o código para um repositório no GitHub, GitLab ou Bitbucket. Confira que `.env.local` **não** foi commitado (`git status` não pode mostrá-lo).
2. Na Vercel: **Add New... > Project** e importe o repositório.
3. Framework Preset: **Next.js** (detectado automaticamente). Build Command, Output e Install ficam no padrão.
4. Node.js Version (em Settings > General): **20.x** ou mais recente.

## 2. Variáveis de ambiente

Em **Settings > Environment Variables**, cadastre para **Production** (e para Preview, se for usar):

| Variável | Valor | Observação |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` | pública |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` | pública |
| `SUPABASE_SECRET_KEY` | `sb_secret_...` | **secreta**: marque como *Sensitive*. Usada só no servidor, para a gestão de usuários. |

**Não** cadastre na Vercel:

- `SUPABASE_ACCESS_TOKEN`: é um token pessoal com poder administrativo sobre **todos** os projetos da sua conta Supabase. Ele só existe na máquina de quem aplica migrações.
- `SUPABASE_PROJECT_REF`, `DEMO_OWNER`, `DEMO_EMPLOYEE`, `ALLOW_DEMO_SEED`, `ALLOW_DEMO_RESET`: servem só para os scripts locais.

> As variáveis `NEXT_PUBLIC_*` entram no build. Se você mudá-las, faça um **Redeploy**.

## 3. Região

O banco deve ficar perto dos usuários e as funções da Vercel, perto do banco:

- Supabase: **South America (São Paulo) — sa-east-1**.
- Vercel: em **Settings > Functions > Function Region**, escolha **São Paulo, Brazil (gru1)**.

Com regiões diferentes, cada página paga a viagem de ida e volta entre continentes a cada consulta ao banco.

## 4. Configurar o Auth do Supabase para o domínio

Depois do primeiro deploy, anote a URL (por exemplo `https://plascotel.vercel.app`, ou o seu domínio próprio).

No Supabase, em **Authentication > URL Configuration**:

- **Site URL**: `https://plascotel.vercel.app` (ou o domínio próprio).
- **Redirect URLs**: adicione
  - `https://plascotel.vercel.app/**`
  - o domínio próprio, se houver: `https://app.suaempresa.com.br/**`
  - para Previews (opcional): `https://*-<sua-equipe>.vercel.app/**`
  - para desenvolvimento: `http://localhost:3000/**`

Em **Authentication > Sign In / Providers**, mantenha **Allow new users to sign up** desativado.

## 5. Domínio próprio (opcional)

Em **Settings > Domains**, adicione o domínio e crie o registro DNS indicado (CNAME ou A). O HTTPS é emitido automaticamente. Depois disso, atualize a **Site URL** e as **Redirect URLs** do Supabase.

## 6. Verificação pós-deploy

- [ ] `/login` abre e o login funciona com o usuário proprietário real.
- [ ] O painel carrega os números e as páginas de clientes, vendas e cobranças respondem.
- [ ] **Configurações > Usuários** lista os usuários. Se der erro, a `SUPABASE_SECRET_KEY` está errada ou faltando.
- [ ] Anexar e abrir um comprovante funciona (bucket privado com URL assinada).
- [ ] No celular, o site abre em HTTPS e **Adicionar à tela inicial** instala o app com o ícone PLASCOTEL.
- [ ] Os cabeçalhos de segurança estão presentes (`X-Frame-Options`, `Strict-Transport-Security`), conferidos nas DevTools > Network.

## 7. Atualizações

- Cada push na branch principal gera um deploy de produção. As outras branches geram Previews.
- **Mudou o banco?** Aplique a migração **antes** de publicar o código que depende dela (`npm run db:migrate` na sua máquina), depois regenere os tipos (`npm run db:types`) e faça o commit.
- Para voltar uma versão: em **Deployments**, escolha um deploy anterior e use **Promote to Production**. Migrações não são desfeitas automaticamente. Escreva migrações compatíveis com a versão anterior do código.

## Configuração atual (novembro/2026)

| Ambiente | Supabase | Região | Uso |
|---|---|---|---|
| **Produção** | projeto `plascotel-sp` | `sa-east-1` (São Paulo) | dados reais, sem dados fictícios |
| **Desenvolvimento / Preview** | projeto de desenvolvimento | `us-west-2` | dados de demonstração e testes E2E |

- Vercel: projeto `gestaoplascotel` (time `teixeira6`), conectado ao GitHub `teixeirzkj/gestaoplascotel`. Cada push em `main` publica em produção; branches e PRs geram previews que usam o banco de **desenvolvimento**.
- Funções na região `gru1` (São Paulo), definida em `vercel.json`, ao lado do banco de produção.
- Node.js 24 LTS (`engines` no `package.json`).
- Supabase Auth (produção): cadastro público **desativado** (somente o proprietário cria usuários), senha mínima de 8 caracteres, Site URL `https://gestaoplascotel.vercel.app`.
- Migrações em produção: `DB_TARGET=prod node scripts/db.mjs migrate` e a suíte `DB_TARGET=prod node scripts/db.mjs file supabase/tests/financial_rules.sql` (requer `PROD_SUPABASE_PROJECT_REF` e `PROD_SUPABASE_ACCESS_TOKEN` no `.env.local`). Aplique sempre primeiro no desenvolvimento.
