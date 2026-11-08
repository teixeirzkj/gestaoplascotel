#!/usr/bin/env node
// Teste de invasão SEM LOGIN (não destrutivo): simula um atacante que só tem a URL do site e a chave
// publicável (visível no navegador). Nada aqui grava dados com sucesso; toda escrita deve ser NEGADA.
// Uso: node tests/security/anon-probe.mjs [prod|dev]
import fs from "node:fs";

const target = process.argv[2] === "dev" ? "dev" : "prod";
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const SB = target === "prod" ? env.PROD_NEXT_PUBLIC_SUPABASE_URL : env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = target === "prod" ? env.PROD_NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY : env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const APP = process.env.APP_URL || (target === "prod" ? "https://gestaoplascotel.vercel.app" : "http://localhost:3100");
const H = { apikey: KEY, "Content-Type": "application/json" };

const results = [];
const check = (name, pass, detail = "") => results.push({ name, pass, detail });

const TABLES = [
  "profiles", "cities", "customers", "products", "sales", "sale_items", "installments", "payments", "payment_receipts",
  "payment_postponements", "payment_promises", "visits", "visit_customers", "customer_notes", "cash_movements",
  "cash_closings", "activity_logs", "notification_reads", "app_settings",
  "v_installments", "v_sales", "v_customers", "v_promises", "v_payments", "v_activity", "v_cash_movements",
];

// 1) Leitura anônima de todas as tabelas/views
for (const t of TABLES) {
  const r = await fetch(`${SB}/rest/v1/${t}?select=*&limit=1`, { headers: H });
  const body = await r.text();
  const leaked = r.ok && body.trim() !== "[]";
  check(`anon SELECT ${t}`, !leaked, `${r.status} ${body.slice(0, 80)}`);
}

// 2) Escrita anônima
for (const [t, row] of [
  ["customers", { full_name: "Invasor Teste" }],
  ["profiles", { id: "00000000-0000-0000-0000-000000000000", role: "owner" }],
  ["payments", { amount: 1 }],
  ["activity_logs", { action: "x", entity_type: "x", summary: "x" }],
  ["app_settings", { key: "pwn", value: {} }],
]) {
  const r = await fetch(`${SB}/rest/v1/${t}`, { method: "POST", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify(row) });
  check(`anon INSERT ${t}`, !r.ok, `${r.status}`);
}
const del = await fetch(`${SB}/rest/v1/activity_logs?id=gt.0`, { method: "DELETE", headers: { ...H, Prefer: "return=representation" } });
check("anon DELETE activity_logs", !del.ok || (await del.text()).trim() === "[]", `${del.status}`);

// 3) RPCs anônimas
const RPCS = {
  dashboard_summary: {}, get_notifications: {}, global_search: { p_query: "a" }, report_summary: { p_from: "2020-01-01", p_to: "2030-01-01" },
  create_sale: { p: {} }, register_payment: { p_installment_id: "00000000-0000-0000-0000-000000000000", p_amount: 1, p_paid_on: "2026-01-01", p_method: "pix", p_notes: null, p_confirm: true, p_idempotency_key: "00000000-0000-0000-0000-000000000001" },
  reverse_payment: { p_payment_id: "00000000-0000-0000-0000-000000000000", p_reason: "teste invasao" },
  cash_adjustment: { p_amount: 1, p_method: "cash", p_date: "2026-01-01", p_justification: "teste invasao" },
  is_owner: {}, log_activity: { p_action: "x", p_entity_type: "x", p_entity_id: null, p_customer_id: null, p_summary: "x" },
  handle_new_user: {}, audit_row: {},
};
for (const [fn, args] of Object.entries(RPCS)) {
  const r = await fetch(`${SB}/rest/v1/rpc/${fn}`, { method: "POST", headers: H, body: JSON.stringify(args) });
  const body = await r.text();
  const ok = !r.ok || body === "false" || body === "null" || body === "[]";
  check(`anon RPC ${fn}`, ok, `${r.status} ${body.slice(0, 80)}`);
}

// 4) Storage de comprovantes
const ls = await fetch(`${SB}/storage/v1/object/list/receipts`, { method: "POST", headers: H, body: JSON.stringify({ prefix: "payments/", limit: 5 }) });
const lsBody = await ls.text();
check("anon listar bucket receipts", !ls.ok || lsBody.trim() === "[]", `${ls.status} ${lsBody.slice(0, 80)}`);
const pub = await fetch(`${SB}/storage/v1/object/public/receipts/payments/x.png`);
check("bucket receipts não é público", pub.status >= 400, `${pub.status}`);
const up = await fetch(`${SB}/storage/v1/object/receipts/payments/00000000-0000-0000-0000-000000000000/pwn.png`, { method: "POST", headers: { apikey: KEY, "Content-Type": "image/png" }, body: "x" });
check("anon upload no bucket", !up.ok, `${up.status}`);
const buckets = await fetch(`${SB}/storage/v1/bucket`, { headers: H });
const bBody = await buckets.text();
check("anon listar buckets", !buckets.ok || bBody.trim() === "[]", `${buckets.status} ${bBody.slice(0, 60)}`);

// 5) Auth: cadastro público deve estar desativado
const su = await fetch(`${SB}/auth/v1/signup`, { method: "POST", headers: H, body: JSON.stringify({ email: `invasor${Date.now()}@example.com`, password: "SenhaForte123!" }) });
const suBody = await su.text();
check("cadastro público desativado", !su.ok, `${su.status} ${suBody.slice(0, 100)}`);
const anon = await fetch(`${SB}/auth/v1/signup`, { method: "POST", headers: H, body: JSON.stringify({}) });
check("login anônimo (anonymous users) desativado", !anon.ok, `${anon.status}`);

// 6) Aplicação web sem sessão
for (const p of ["/", "/clientes", "/vendas/nova", "/caixa", "/configuracoes", "/perfil"]) {
  const r = await fetch(APP + p, { redirect: "manual" });
  const loc = r.headers.get("location") || "";
  check(`app ${p} sem login redireciona`, r.status >= 300 && r.status < 400 && loc.includes("/login"), `${r.status} -> ${loc}`);
}
for (const tipo of ["resumo", "cidades", "inadimplencia", "caixa", "vendas"]) {
  const r = await fetch(`${APP}/api/export/${tipo}?de=2020-01-01&ate=2030-01-01`, { redirect: "manual" });
  const ct = r.headers.get("content-type") || "";
  check(`export ${tipo} sem login bloqueado`, !(r.status === 200 && ct.includes("csv")), `${r.status} ${ct}`);
}
// open redirect: o campo oculto "next" do formulário nunca pode carregar destino externo
// (a URL atual aparece codificada no estado interno do Next, o que é inofensivo)
for (const evil of ["//evil.example.com", "/\\evil.example.com", "https://evil.example.com", "/%09/evil.example.com"]) {
  const orl = await fetch(`${APP}/login?next=${encodeURIComponent(evil)}`, { redirect: "manual" });
  const orlBody = await orl.text();
  const hidden = orlBody.match(/name="next"[^>]*value="([^"]*)"|value="([^"]*)"[^>]*name="next"/);
  const v = hidden ? hidden[1] ?? hidden[2] : "";
  check(`login descarta next externo (${evil})`, !/evil/.test(v), `campo next="${v}"`);
}

// 7) Cabeçalhos de segurança
const h = await fetch(APP + "/login");
for (const [k, test] of [
  ["content-security-policy", (v) => /default-src 'self'/.test(v) && /frame-ancestors 'none'/.test(v)],
  ["strict-transport-security", (v) => /max-age=\d{7,}/.test(v)],
  ["x-frame-options", (v) => /DENY/i.test(v)],
  ["x-content-type-options", (v) => /nosniff/i.test(v)],
  ["referrer-policy", (v) => v.length > 0],
]) {
  const v = h.headers.get(k) || "";
  check(`header ${k}`, target === "dev" && k === "strict-transport-security" ? true : test(v), v.slice(0, 70));
}
check("sem header x-powered-by", !h.headers.get("x-powered-by"), h.headers.get("x-powered-by") || "");

// 8) Segredos no JavaScript público
const html = await (await fetch(APP + "/login")).text();
const scripts = [...new Set([...html.matchAll(/\/_next\/static\/[^"']+\.js/g)].map((m) => m[0]))];
let leak = "";
for (const s of scripts) {
  const js = await (await fetch(APP + s)).text();
  const m = js.match(/sb_secret_[A-Za-z0-9_-]{8,}|service_role|sbp_[a-f0-9]{20,}|SUPABASE_SECRET_KEY|PROD_DB_PASSWORD/);
  if (m) leak += `${s}:${m[0].slice(0, 20)} `;
}
check(`nenhum segredo nos ${scripts.length} scripts públicos`, !leak, leak);

const failed = results.filter((r) => !r.pass);
for (const r of results) console.log(`${r.pass ? "✓" : "✖"} ${r.name}${r.pass ? "" : "  →  " + r.detail}`);
console.log(`\n${results.length - failed.length}/${results.length} defesas OK (${target})`);
process.exitCode = failed.length ? 1 : 0;
