# Backup e restauração

Todo o dado do PLASCOTEL fica no Supabase. São duas partes:

1. **Banco Postgres**: clientes, vendas, parcelas, pagamentos, caixa, auditoria, usuários (`auth`) e perfis.
2. **Storage**: o bucket privado `receipts`, com os arquivos de comprovantes em `payments/<id do pagamento>/<arquivo>`.

Um backup completo precisa das duas. Um dump do banco **não** inclui os arquivos do Storage, só a tabela de metadados `storage.objects`.

## 1. Backups automáticos do Supabase

| Plano | Backup diário | Retenção | PITR (restauração para um instante) |
|---|---|---|---|
| Free | Não há backups baixáveis | — | Não |
| Pro | Sim, diário | 7 dias | Add-on pago |
| Team | Sim, diário | 14 dias | Add-on pago |
| Enterprise | Sim, diário | até 30 dias | Add-on pago |

Os valores mudam com o tempo. Confira a página de preços e a documentação de *Database Backups* do Supabase.

- Os backups ficam em **Dashboard > Database > Backups**. A restauração é feita pelo próprio Dashboard e **substitui o banco inteiro** pelo estado daquele dia.
- **PITR (Point-in-Time Recovery)** permite voltar o banco a um instante exato, com granularidade de segundos. É útil quando um erro operacional é descoberto horas depois. Recomendado assim que o sistema tiver uso diário relevante.
- Os backups automáticos **não** incluem os arquivos do Storage.

**Recomendação:** plano Pro ou superior para uso em produção. No plano Free, os backups manuais abaixo são a **única** proteção.

## 2. Backup manual do banco (pg_dump)

### Connection string

Em **Dashboard > Connect** (ou Project Settings > Database), copie a connection string do **Session pooler** (porta 5432), que funciona em redes só com IPv4:

```
postgresql://postgres.<ref>:<SENHA_DO_BANCO>@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
```

> A senha do banco é diferente das chaves de API. Guarde-a num gerenciador de senhas e nunca a coloque em scripts commitados. Use a variável `PGPASSWORD` ou um arquivo `.pgpass`.

Use um `pg_dump` da **mesma versão principal** do Postgres do projeto, ou mais nova (veja em Project Settings > Infrastructure).

### Opção A: Supabase CLI (recomendada)

```bash
npx supabase db dump --db-url "$DB_URL" -f backup/roles.sql --role-only
npx supabase db dump --db-url "$DB_URL" -f backup/schema.sql
npx supabase db dump --db-url "$DB_URL" -f backup/data.sql --use-copy --data-only
```

### Opção B: pg_dump direto (inclui `auth` e `storage`, formato custom)

```bash
pg_dump "$DB_URL" -Fc --no-owner --no-privileges \
  -n public -n auth -n storage -n supabase_migrations \
  -f backup/plascotel-$(date +%F).dump
```

- `public`: dados de negócio. `auth`: usuários e senhas (hash). `storage`: metadados dos arquivos. `supabase_migrations`: controle das migrações aplicadas.
- O arquivo contém **dados pessoais e hashes de senha**. Guarde-o criptografado (por exemplo, um zip com senha ou um disco criptografado) e fora do computador do dia a dia.

## 3. Backup dos comprovantes (bucket `receipts`)

O bucket é privado. Baixe os arquivos com a chave secreta, numa máquina confiável. Um jeito simples é usar o protocolo S3 do Storage (Dashboard > Storage > S3 Connection: gere um *access key*):

```bash
aws s3 sync s3://receipts ./backup/receipts \
  --endpoint-url https://<ref>.supabase.co/storage/v1/s3 --region sa-east-1
```

Também dá para baixar pela API de Storage com o `@supabase/supabase-js` (`storage.from("receipts").list()` e `.download()`). O `scripts/reset-demo.mjs` mostra como autenticar com a `SUPABASE_SECRET_KEY`.

## 4. Restauração

### A partir do backup automático ou PITR

Dashboard > Database > Backups, escolha o ponto e confirme. O projeto fica indisponível por alguns minutos. **Tudo o que foi lançado depois do ponto escolhido é perdido.** Anote antes os pagamentos recentes, para relançar depois.

### A partir de um dump manual (projeto novo, recomendado para testes)

1. Crie um projeto Supabase novo, na mesma região.
2. Restaure:
   ```bash
   # Arquivos da opção A
   psql "$NOVO_DB_URL" -f backup/roles.sql
   psql "$NOVO_DB_URL" -f backup/schema.sql
   psql "$NOVO_DB_URL" -c "set session_replication_role = replica" -f backup/data.sql
   # ou, opção B
   pg_restore -d "$NOVO_DB_URL" --no-owner --no-privileges --clean --if-exists backup/plascotel-AAAA-MM-DD.dump
   ```
3. Reenvie os comprovantes, mantendo os mesmos caminhos:
   ```bash
   aws s3 sync ./backup/receipts s3://receipts --endpoint-url https://<novo-ref>.supabase.co/storage/v1/s3 --region sa-east-1
   ```
4. Aponte o `.env.local` (ou as variáveis da Vercel) para o novo projeto e confira o login.

> Restaurar por cima do projeto em uso só em último caso, e depois de um dump do estado atual.

## 5. Rotina recomendada

| Quando | O quê |
|---|---|
| **Diário** (automático) | Backup do Supabase (plano Pro ou superior). Com PITR, a proteção é contínua. |
| **Semanal** (sexta, após a conferência do caixa) | `pg_dump` (opção B) + `aws s3 sync` dos comprovantes. Guardar em dois lugares (ex.: HD externo + nuvem pessoal), criptografados. Manter as últimas 4 semanas. |
| **Mensal** (1º dia útil) | Guardar o dump semanal como **mensal** por 12 meses. Exportar os relatórios do mês (CSV em Relatórios) como registro contábil. |
| **Trimestral** | **Teste de restauração** (seção 6). |
| **Antes de qualquer migração ou operação em massa** | Dump manual na hora. |

## 6. Teste de restauração (trimestral)

Um backup que nunca foi restaurado não está garantido.

1. Crie um projeto Supabase temporário e restaure o último dump semanal e os comprovantes (seção 4).
2. Rode localmente apontando para ele e confira:
   - [ ] o login funciona com um usuário real;
   - [ ] os totais do painel (a receber, em atraso, recebido no mês) batem com produção na data do dump;
   - [ ] uma venda antiga abre com parcelas e pagamentos;
   - [ ] um comprovante abre (URL assinada);
   - [ ] o histórico (auditoria) mostra os registros;
   - [ ] `npm run db:test` termina com `TESTES_OK`.
3. Anote a data, o tempo gasto e os problemas encontrados. Apague o projeto temporário.
