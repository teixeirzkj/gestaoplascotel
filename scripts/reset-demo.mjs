#!/usr/bin/env node
// PLASCOTEL — APAGA TODOS OS DADOS DE NEGÓCIO do projeto Supabase configurado em .env.local.
//
// Para que serve: limpar os dados de demonstração antes de começar a usar o sistema de verdade.
// O que é apagado: cidades, produtos, clientes, vendas, itens, parcelas, pagamentos, comprovantes
//   (registros + arquivos do bucket "receipts"), adiamentos, promessas, visitas, observações,
//   movimentos e conferências de caixa, notificações lidas e o histórico de auditoria.
//   Os códigos de venda voltam a começar do #1.
// O que é preservado: usuários (auth.users), perfis/papéis (profiles) e configurações (app_settings).
//
// Uso (IRREVERSÍVEL — faça backup antes se houver qualquer dado real; veja docs/BACKUP.md):
//   bash/zsh:   ALLOW_DEMO_RESET=true npm run reset:demo -- --confirm=<SUPABASE_PROJECT_REF>
//   PowerShell: $env:ALLOW_DEMO_RESET="true"; npm run reset:demo -- --confirm=<SUPABASE_PROJECT_REF>
// Opcional: --keep-catalog  mantém cidades e produtos (apaga só o restante).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFile = path.join(root, ".env.local");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

function stop(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

const { SUPABASE_ACCESS_TOKEN: token, SUPABASE_PROJECT_REF: ref, NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SECRET_KEY: secret } = process.env;
const missing = Object.entries({ SUPABASE_ACCESS_TOKEN: token, SUPABASE_PROJECT_REF: ref, NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SECRET_KEY: secret })
  .filter(([, v]) => !v)
  .map(([k]) => k);
if (missing.length) stop(`Variáveis ausentes em .env.local: ${missing.join(", ")}`);

const args = process.argv.slice(2);
const confirm = args.find((a) => a.startsWith("--confirm="))?.slice("--confirm=".length);
const keepCatalog = args.includes("--keep-catalog");

if (process.env.ALLOW_DEMO_RESET !== "true" || confirm !== ref) {
  stop(
    "Reset bloqueado. Este comando APAGA DEFINITIVAMENTE todos os dados de negócio\n" +
      `  (clientes, vendas, pagamentos, comprovantes, caixa, auditoria...) do projeto "${ref}".\n` +
      "  Usuários, papéis e configurações são preservados.\n\n" +
      "  Para confirmar, defina ALLOW_DEMO_RESET=true e digite o ref do projeto:\n" +
      `    bash/zsh:   ALLOW_DEMO_RESET=true npm run reset:demo -- --confirm=${ref}\n` +
      `    PowerShell: $env:ALLOW_DEMO_RESET="true"; npm run reset:demo -- --confirm=${ref}\n` +
      (confirm && confirm !== ref ? `\n  O ref informado ("${confirm}") não confere com SUPABASE_PROJECT_REF.` : ""),
  );
}

async function query(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Banco respondeu HTTP ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

// Todas na MESMA instrução TRUNCATE (o Postgres resolve as chaves estrangeiras entre elas).
const BUSINESS_TABLES = [
  "activity_logs", "notification_reads", "cash_closings", "cash_movements", "customer_notes",
  "visit_customers", "visits", "payment_receipts", "payment_promises", "payment_postponements",
  "payments", "installments", "sale_items", "sales", "customers",
  ...(keepCatalog ? [] : ["products", "cities"]),
];

async function main() {
  const [before] = await query(`select
    (select count(*) from public.customers) as clientes, (select count(*) from public.sales) as vendas,
    (select count(*) from public.payments) as pagamentos,
    (select count(*) from storage.objects where bucket_id = 'receipts') as arquivos_comprovantes`);
  console.log(`Projeto: ${ref}. Antes do reset:`);
  console.table(before);

  // 1) Arquivos do bucket privado "receipts" (via API de Storage; o SQL não pode apagá-los)
  const names = (await query("select name from storage.objects where bucket_id = 'receipts' order by name")).map((r) => r.name);
  if (names.length) {
    const storage = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } }).storage;
    for (let i = 0; i < names.length; i += 100) {
      const { error } = await storage.from("receipts").remove(names.slice(i, i + 100));
      if (error) throw new Error(`Falha ao remover comprovantes do Storage: ${error.message}`);
    }
  }
  console.log(`Arquivos removidos do bucket "receipts": ${names.length}`);

  // 2) Tabelas de negócio (profiles, auth e app_settings ficam intactos)
  await query(`truncate table ${BUSINESS_TABLES.map((t) => `public.${t}`).join(", ")} restart identity;`);
  console.log(`Tabelas limpas: ${BUSINESS_TABLES.join(", ")}`);

  const [after] = await query(`select
    (select count(*) from public.customers) as clientes, (select count(*) from public.sales) as vendas,
    (select count(*) from public.payments) as pagamentos, (select count(*) from public.profiles) as usuarios_preservados,
    (select count(*) from storage.objects where bucket_id = 'receipts') as arquivos_comprovantes`);
  console.table(after);
  console.log("\n✔ Banco limpo. Próximos passos para uso real: docs/SETUP.md (seção \"Começar a usar de verdade\").\n");
}

main().catch((e) => {
  console.error(`\n✖ ${e.message}\n`);
  process.exitCode = 1;
});
