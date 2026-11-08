#!/usr/bin/env node
// Ataques à aplicação web (ambiente de DESENVOLVIMENTO; cria dados de teste no banco dev):
// XSS armazenado, CSRF em Server Actions, replay sem sessão, injeção em filtros de busca e força bruta no login.
// Requer o app rodando (APP_URL, padrão http://localhost:3100) apontando para o banco de desenvolvimento.
import fs from "node:fs";
import { chromium } from "playwright";

const APP = process.env.APP_URL || "http://localhost:3100";
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const SB = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const [ownerEmail, ownerPw] = env.DEMO_OWNER.split(" ");
const [empEmail, empPw] = env.DEMO_EMPLOYEE.split(" ");
const results = [];
const check = (name, pass, detail = "") => results.push({ name, pass, detail });

// ---------- XSS armazenado: proprietário cadastra cliente com payloads; funcionário abre as telas
const XSS = `<img src=x onerror="window.__xss=1"><script>window.__xss=1</script>"><svg onload=window.__xss=1>`;
const ownerTok = (await (await fetch(`${SB}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email: ownerEmail, password: ownerPw }) })).json()).access_token;
const OH = { apikey: KEY, Authorization: `Bearer ${ownerTok}`, "Content-Type": "application/json", Prefer: "return=representation" };
const [cust] = await (await fetch(`${SB}/rest/v1/customers`, { method: "POST", headers: OH, body: JSON.stringify({ full_name: "XSS " + XSS, neighborhood: XSS, address: XSS, reference: XSS, notes: XSS }) })).json();
await fetch(`${SB}/rest/v1/customer_notes`, { method: "POST", headers: OH, body: JSON.stringify({ customer_id: cust.id, kind: "note", body: XSS, created_by: JSON.parse(Buffer.from(ownerTok.split(".")[1], "base64url")).sub }) });

const browser = await chromium.launch();
async function login(email, pw) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const pg = await ctx.newPage();
  await pg.goto(APP + "/login");
  await pg.fill('input[name="email"]', email);
  await pg.fill('input[name="password"]', pw);
  await Promise.all([pg.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 }), pg.click('button[type="submit"]')]);
  return { ctx, pg };
}
const emp = await login(empEmail, empPw);
let dialogs = 0;
emp.pg.on("dialog", (d) => { dialogs++; d.dismiss(); });
for (const p of ["/", `/clientes?q=XSS`, `/clientes/${cust.id}`, `/clientes/${cust.id}?aba=historico`, `/clientes/${cust.id}?aba=observacoes`, "/historico"]) {
  await emp.pg.goto(APP + p, { waitUntil: "networkidle" });
  const fired = await emp.pg.evaluate(() => Boolean(window.__xss));
  const rawTags = await emp.pg.evaluate(() => document.querySelectorAll("main img[src='x'], main svg[onload], main script:not([src]):not([nonce])").length);
  check(`XSS armazenado não executa em ${p.replace(cust.id, "<id>")}`, !fired && rawTags === 0 && dialogs === 0, `executou=${fired} tags=${rawTags}`);
}
// busca global com payload
await emp.pg.goto(APP + "/", { waitUntil: "networkidle" });
await emp.pg.keyboard.press("Control+k");
await emp.pg.keyboard.type("XSS <img");
await emp.pg.waitForTimeout(1500);
check("XSS não executa na busca global", !(await emp.pg.evaluate(() => Boolean(window.__xss))), "");

// ---------- Injeção em filtros de busca (PostgREST .or/.ilike montados com texto do usuário)
for (const [path, q] of [
  ["/clientes", "a),full_name.eq.x(,id.neq.0"], ["/clientes", "%,*,(,),\\"], ["/cobrancas", "x).or(id.neq.0"], ["/vendas", "#1 or 1=1"], ["/historico", "a%' or '1'='1"],
]) {
  const r = await emp.pg.goto(`${APP}${path}?q=${encodeURIComponent(q)}`, { waitUntil: "networkidle" });
  const errorPage = await emp.pg.locator("text=Algo deu errado").count();
  check(`filtro de busca resiste a injeção em ${path} (${q.slice(0, 16)})`, (r?.status() ?? 500) < 500 && errorPage === 0, `${r?.status()} erroNaTela=${errorPage}`);
}

// ---------- CSRF / replay de Server Action
// Captura uma Server Action legítima do funcionário (marcar notificações como lidas) e a reenvia de forma maliciosa.
let captured = null;
emp.pg.on("request", (req) => { if (req.method() === "POST" && req.headers()["next-action"] && !captured) captured = { url: req.url(), headers: req.headers(), body: req.postData() }; });
await emp.pg.goto(`${APP}/clientes/${cust.id}?aba=observacoes`, { waitUntil: "networkidle" });
const textarea = emp.pg.locator("textarea").first();
if (await textarea.count()) {
  await textarea.fill("nota legítima do teste de segurança");
  await emp.pg.getByRole("button", { name: /Adicionar|Salvar|Registrar/i }).first().click();
  await emp.pg.waitForTimeout(2500);
}
if (captured) {
  const cookies = (await emp.ctx.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
  const base = { "content-type": captured.headers["content-type"], "next-action": captured.headers["next-action"], "next-router-state-tree": captured.headers["next-router-state-tree"] ?? "", accept: "text/x-component" };
  // a) CSRF: outro site (Origin diferente) com o cookie da vítima
  const csrf = await fetch(captured.url, { method: "POST", headers: { ...base, cookie: cookies, origin: "https://evil.example.com" }, body: captured.body });
  const csrfBody = await csrf.text();
  check("CSRF: Server Action recusada vinda de outro site", !csrf.ok || !/"ok":true/.test(csrfBody), `${csrf.status} ${csrfBody.slice(0, 80)}`);
  // b) Replay sem sessão
  const noAuth = await fetch(captured.url, { method: "POST", headers: { ...base, origin: new URL(APP).origin }, body: captured.body });
  const noAuthBody = await noAuth.text();
  check("Server Action sem sessão é recusada", !/"ok":true/.test(noAuthBody), `${noAuth.status} ${noAuthBody.slice(0, 100)}`);
} else check("captura de Server Action para teste de CSRF", false, "nenhuma action capturada");

// ---------- Força bruta no login
let blocked = false, lastMsg = "";
const bruteEmail = "forca-bruta-" + Date.now() + "@example.com"; // e-mail inexistente: não tranca usuários reais
for (let i = 1; i <= 8; i++) {
  const ctx = await browser.newContext(); const pg = await ctx.newPage();
  await pg.goto(APP + "/login");
  await pg.fill('input[name="email"]', bruteEmail);
  await pg.fill('input[name="password"]', "senha-errada-" + i);
  await pg.click('button[type="submit"]');
  await pg.waitForSelector('form p[role="alert"]', { timeout: 15000 }).catch(() => null);
  lastMsg = (await pg.locator('form p[role="alert"]').first().textContent().catch(() => "")) || "";
  await ctx.close();
  if (/tentativas|aguarde|bloquead/i.test(lastMsg)) { blocked = true; check(`força bruta bloqueada na tentativa ${i}`, i <= 6, lastMsg); break; }
}
if (!blocked) check("força bruta no login é bloqueada após várias tentativas", false, `8 tentativas sem bloqueio. Última mensagem: ${lastMsg}`);

await browser.close();
// limpeza: arquiva o cliente de teste
await fetch(`${SB}/rest/v1/customers?id=eq.${cust.id}`, { method: "PATCH", headers: OH, body: JSON.stringify({ archived_at: new Date().toISOString() }) });

const failed = results.filter((x) => !x.pass);
for (const x of results) console.log(`${x.pass ? "✓" : "✖"} ${x.name}${x.pass ? "" : "  →  " + x.detail}`);
console.log(`\n${results.length - failed.length}/${results.length} defesas OK (web, dev)`);
process.exitCode = failed.length ? 1 : 0;
