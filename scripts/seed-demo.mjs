#!/usr/bin/env node
// PLASCOTEL — carga de DADOS DE DEMONSTRAÇÃO (somente desenvolvimento/apresentação).
//
// Uso:  ALLOW_DEMO_SEED=true npm run seed:demo
//       (PowerShell: $env:ALLOW_DEMO_SEED="true"; npm run seed:demo)
//
// O que faz:
//   1. Executa supabase/seed/demo.sql via Supabase Management API (como postgres; o SQL simula
//      os usuários demo para que as RPCs reais validem regras e gravem auditoria).
//   2. Gera um PDF fictício de comprovante Pix, sobe ao bucket privado "receipts" com a chave secreta
//      e registra em payment_receipts (simulando o funcionário demo que lançou o pagamento).
//   3. Mostra um resumo (contagens, dashboard_summary(), delinquency_aging()).
//
// Requer em .env.local: SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY.
// Recusa rodar com NODE_ENV=production ou sem ALLOW_DEMO_SEED=true.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadEnv(path.join(root, ".env.local"));

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

if (process.env.NODE_ENV === "production") {
  fail("Seed de demonstração bloqueado: NODE_ENV=production. Dados fictícios nunca devem ir para o ambiente de produção.");
}
if (process.env.ALLOW_DEMO_SEED !== "true") {
  fail(
    "Seed de demonstração bloqueado por segurança.\n" +
      "  Ele grava clientes, vendas e pagamentos FICTÍCIOS no projeto Supabase configurado em .env.local.\n" +
      "  Para confirmar, rode com ALLOW_DEMO_SEED=true:\n" +
      "    bash/zsh:   ALLOW_DEMO_SEED=true npm run seed:demo\n" +
      '    PowerShell: $env:ALLOW_DEMO_SEED="true"; npm run seed:demo',
  );
}

const { SUPABASE_ACCESS_TOKEN: token, SUPABASE_PROJECT_REF: ref, NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SECRET_KEY: secret } = process.env;
const missing = Object.entries({ SUPABASE_ACCESS_TOKEN: token, SUPABASE_PROJECT_REF: ref, NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SECRET_KEY: secret })
  .filter(([, v]) => !v)
  .map(([k]) => k);
if (missing.length) fail(`Variáveis ausentes em .env.local: ${missing.join(", ")}`);

async function query(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text;
    try {
      msg = JSON.parse(text).message ?? text;
    } catch {
      /* resposta não-JSON: mantém o texto */
    }
    throw new Error(`Banco respondeu HTTP ${res.status}: ${msg}`);
  }
  return text ? JSON.parse(text) : null;
}

const lit = (v) => `'${String(v).replace(/'/g, "''")}'`;

// ---------------------------------------------------------------------------
// PDF mínimo (1 página, Helvetica/WinAnsi) — documento claramente fictício
// ---------------------------------------------------------------------------
function buildReceiptPdf({ customerName, amount, paidOn, paymentId }) {
  const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(amount)).replace(/ /g, " ");
  const [y, m, d] = String(paidOn).slice(0, 10).split("-");
  const esc = (s) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const lines = [
    ["F2", 18, 60, 770, "Comprovante de transferência Pix"],
    ["F1", 10, 60, 750, "DOCUMENTO FICTÍCIO — DADOS DE DEMONSTRAÇÃO DO SISTEMA PLASCOTEL"],
    ["F1", 11, 60, 712, "Valor"],
    ["F2", 22, 60, 688, brl],
    ["F1", 11, 60, 652, `Data: ${d}/${m}/${y}`],
    ["F1", 11, 60, 632, `Pagador: ${customerName}`],
    ["F1", 11, 60, 612, "Recebedor: PLASCOTEL (conta fictícia)"],
    ["F1", 11, 60, 592, "Chave Pix: chave-demo@plascotel.app"],
    ["F1", 9, 60, 560, `Identificador: DEMO-${paymentId.slice(0, 8).toUpperCase()}`],
  ];
  const stream = lines.map(([f, size, x, yy, text]) => `BT /${f} ${size} Tf ${x} ${yy} Td (${esc(text)}) Tj ET`).join("\n");
  const streamBytes = Buffer.from(stream, "latin1");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    null, // stream
  ];
  const chunks = [Buffer.from("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n", "latin1")];
  const offsets = [];
  let size = chunks[0].length;
  objects.forEach((obj, i) => {
    offsets.push(size);
    const body =
      obj === null
        ? Buffer.concat([Buffer.from(`${i + 1} 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n`, "latin1"), streamBytes, Buffer.from("\nendstream\nendobj\n", "latin1")])
        : Buffer.from(`${i + 1} 0 obj\n${obj}\nendobj\n`, "latin1");
    chunks.push(body);
    size += body.length;
  });
  const xref =
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
    offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("") +
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${size}\n%%EOF\n`;
  chunks.push(Buffer.from(xref, "latin1"));
  return Buffer.concat(chunks);
}

// ---------------------------------------------------------------------------
async function main() {
  console.log(`Projeto Supabase: ${ref}`);
  console.log("1/3 Executando supabase/seed/demo.sql ...");
  const sql = fs.readFileSync(path.join(root, "supabase", "seed", "demo.sql"), "utf8");
  const pending = (await query(sql)) ?? [];
  console.log("    ok — dados de demonstração gravados.");

  console.log(`2/3 Anexando comprovante(s) Pix de demonstração (${pending.length}) ...`);
  const storage = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } }).storage;
  for (const p of pending) {
    const pdf = buildReceiptPdf({ customerName: p.customer_name, amount: p.amount, paidOn: p.paid_on, paymentId: p.payment_id });
    const fileName = "comprovante-pix-demo.pdf";
    const storagePath = `payments/${p.payment_id}/${fileName}`;
    const { error } = await storage.from("receipts").upload(storagePath, pdf, { contentType: "application/pdf", upsert: true });
    if (error) throw new Error(`Falha ao enviar ${storagePath} ao Storage: ${error.message}`);
    // Registro do comprovante simulando quem lançou o pagamento (RLS + gatilho de auditoria reais)
    await query(`do $$ begin
      perform set_config('request.jwt.claims', json_build_object('sub', ${lit(p.created_by)}, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      insert into public.payment_receipts (payment_id, storage_path, file_name, mime_type, size_bytes, uploaded_by)
      values (${lit(p.payment_id)}, ${lit(storagePath)}, ${lit(fileName)}, 'application/pdf', ${pdf.length}, ${lit(p.created_by)});
    end $$;`);
    console.log(`    ok — ${p.customer_name}: ${storagePath} (${pdf.length} bytes)`);
  }

  console.log("3/3 Conferindo ...");
  const [counts] = await query(`select
      (select count(*) from public.cities) as cidades,
      (select count(*) from public.products) as produtos,
      (select count(*) from public.customers) as clientes,
      (select count(*) from public.sales) as vendas,
      (select count(*) from public.installments) as parcelas,
      (select count(*) from public.payments) as pagamentos,
      (select count(*) from public.payment_receipts) as comprovantes,
      (select count(*) from public.payment_promises) as promessas,
      (select count(*) from public.visits) as visitas,
      (select count(*) from public.activity_logs) as registros_auditoria`);
  console.table(counts);
  const [{ summary }] = await query("select public.dashboard_summary() as summary");
  console.log("dashboard_summary():");
  console.table(summary);
  console.log("delinquency_aging():");
  console.table(await query("select bucket, amount, installments_count, customers_count from public.delinquency_aging()"));
  console.log("\n✔ Demo pronto. Entre com os usuários demo (credenciais em .env.local: DEMO_OWNER / DEMO_EMPLOYEE).");
  console.log("  Para limpar antes de usar de verdade: veja docs/SETUP.md (npm run reset:demo).\n");
}

main().catch((e) => {
  // exitCode em vez de process.exit(): evita abortar o Node no Windows com requisições ainda fechando
  console.error(`\n✖ ${e.message}\n`);
  process.exitCode = 1;
});
