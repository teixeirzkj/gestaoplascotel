# PLASCOTEL

Sistema de gestão comercial e cobranças para venda parcelada porta a porta: clientes, vendas, parcelas, cobranças, visitas às cidades e caixa. Feito para ser usado principalmente **no celular**, na rua, com interface 100% em português e tema escuro.

## Funcionalidades

- **Painel:** a receber, em atraso, recebido hoje e no mês, gráfico dos últimos 6 meses, faixas de inadimplência, cobranças do dia e pendências.
- **Clientes:** cadastro com cidade, bairro, endereço e referência, situação financeira calculada (em dia, atrasado, adiado, quitado...), linha do tempo completa, observações de contato e cobrança, e atalhos para ligar ou chamar no WhatsApp.
- **Vendas:** itens do catálogo ou avulsos, desconto, entrada (recebida no ato ou não) e parcelas com vencimentos editáveis. O cancelamento exige motivo.
- **Cobranças:** cobrar hoje, atrasados, adiados e próximos; recebimento total ou parcial (Pix, dinheiro, transferência), com comprovante; confirmação de Pix pendente; adiamento com motivo e pedido de visita; promessas de pagamento.
- **Agenda de visitas:** visitas por cidade, com sugestão de clientes a visitar e resultado por cliente (visitado, não encontrado, pagamento recebido, nova data).
- **Caixa:** movimentos do dia por forma de pagamento e por usuário, ajustes justificados e conferência diária.
- **Relatórios:** por período e por cidade, inadimplência e exportação CSV.
- **Histórico (auditoria):** quem fez o quê e quando, imutável.
- **Permissões:** proprietário e funcionário, garantidas no banco (RLS + RPCs).
- **PWA:** dá para instalar na tela inicial do celular.

## Stack

Next.js 16 (App Router, Server Actions) · React 19 · TypeScript strict · Tailwind CSS v4 · framer-motion · Supabase (Postgres, Auth, Storage) · Zod 4 · react-hook-form · recharts · sonner · lucide-react

## Início rápido

```bash
npm install
cp .env.example .env.local          # preencha com os dados do seu projeto Supabase
npm run db:migrate                  # aplica as migrações
npm run db:test                     # opcional: suíte de regras financeiras (TESTES_OK)
npm run dev                         # http://localhost:3000
```

Dados fictícios para explorar o sistema (só em desenvolvimento):

```bash
ALLOW_DEMO_SEED=true npm run seed:demo                 # bash/zsh
$env:ALLOW_DEMO_SEED="true"; npm run seed:demo         # PowerShell
```

Os usuários demo são `proprietario.demo@plascotel.app` e `funcionario.demo@plascotel.app`. As senhas estão no `.env.local` (`DEMO_OWNER` / `DEMO_EMPLOYEE`).

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `npm start` | Build e servidor de produção |
| `npm run lint` | ESLint |
| `npm run typecheck` | Checagem de tipos (`tsc --noEmit`) |
| `npm run db:migrate` | Aplica as migrações pendentes de `supabase/migrations` |
| `npm run db:test` | Roda `supabase/tests/financial_rules.sql` (desfaz tudo ao final) |
| `npm run db:types` | Regenera `src/types/supabase.ts` a partir do banco |
| `npm run seed:demo` | Carrega os dados de demonstração (exige `ALLOW_DEMO_SEED=true`) |
| `npm run reset:demo -- --confirm=<ref>` | **Apaga todos os dados de negócio** (exige `ALLOW_DEMO_RESET=true`) |

## Documentação

- [docs/SETUP.md](docs/SETUP.md): variáveis de ambiente, Supabase, migrações, tipos, primeiro usuário, demo e como começar a usar de verdade
- [docs/DEPLOY_VERCEL.md](docs/DEPLOY_VERCEL.md): deploy na Vercel passo a passo
- [docs/BACKUP.md](docs/BACKUP.md): backups, PITR, pg_dump, comprovantes, restauração e rotina
- [docs/SECURITY.md](docs/SECURITY.md): permissões, RLS, RPCs, storage privado, auditoria e rotação de chaves
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): estrutura, fluxo de dados, as três datas (vencimento, cobrança, visita) e como estender
- [CLAUDE.md](CLAUDE.md): convenções de código do projeto
