#!/usr/bin/env node
// Suíte E2E (Playwright, chromium) dos fluxos principais do PLASCOTEL.
//
// Uso:  npm run test:e2e            (ou: node tests/e2e/flows.spec.mjs)
// Variáveis:
//   E2E_BASE_URL   URL do app (padrão http://localhost:3100) — deve apontar para o banco de DESENVOLVIMENTO.
//   E2E_HEADED=1   abre o navegador visível.  E2E_SLOWMO=<ms> desacelera as ações.
//   E2E_ONLY=<texto> roda só os cenários cujo nome contém o texto (os anteriores são pulados; cuidado com dependências).
// Credenciais: DEMO_OWNER e DEMO_EMPLOYEE em .env.local ("email senha"). Verificações no banco usam
// SUPABASE_PROJECT_REF / SUPABASE_ACCESS_TOKEN (Management API, mesmo mecanismo de scripts/db.mjs).
//
// Os cenários são sequenciais e compartilham dados (cliente/produto/vendas criados com nome único por execução).
// Falhas geram screenshot em test-results/e2e/.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const outDir = path.join(root, "test-results", "e2e");
fs.mkdirSync(outDir, { recursive: true });

// ---------------------------------------------------------------- ambiente
const envFile = path.join(root, ".env.local");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const BASE_URL = (process.env.E2E_BASE_URL || "http://localhost:3100").replace(/\/$/, "");
function creds(name) {
  const raw = (process.env[name] || "").trim();
  const i = raw.indexOf(" ");
  if (i < 0) throw new Error(`Defina ${name}="email senha" em .env.local`);
  return { email: raw.slice(0, i).trim(), password: raw.slice(i + 1).trim() };
}
const OWNER = creds("DEMO_OWNER");
const EMPLOYEE = creds("DEMO_EMPLOYEE");
const REF = process.env.SUPABASE_PROJECT_REF;
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!REF || !TOKEN) throw new Error("Defina SUPABASE_PROJECT_REF e SUPABASE_ACCESS_TOKEN em .env.local");

const MOBILE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
const DESKTOP = { viewport: { width: 1366, height: 900 } };

// ---------------------------------------------------------------- utilidades
async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`SQL HTTP ${res.status}: ${text}`);
  return text ? JSON.parse(text) : [];
}
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;

function assert(cond, msg) {
  if (!cond) throw new Error(`Falhou: ${msg}`);
}
function assertEq(actual, expected, msg) {
  if (actual !== expected) throw new Error(`Falhou: ${msg} — esperado ${JSON.stringify(expected)}, obtido ${JSON.stringify(actual)}`);
}
const n2 = (v) => Number(Number(v).toFixed(2));

/** Repete fn até não lançar (ou retornar truthy) dentro do prazo. */
async function until(fn, msg, timeout = 15_000) {
  const t0 = Date.now();
  let last;
  while (Date.now() - t0 < timeout) {
    try {
      const r = await fn();
      if (r !== false) return r;
    } catch (e) {
      last = e;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Tempo esgotado: ${msg}${last ? ` (${last.message})` : ""}`);
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Regex para um valor em reais como formatado pelo app ("R$ 1.234,56" com espaço não separável). */
function brl(v) {
  const s = Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return new RegExp(`R\\$\\s*${esc(s)}`);
}
/** Valor digitado no MoneyInput (máscara de centavos): 120 => "12000". */
const typed = (v) => String(Math.round(v * 100));
const fmtDate = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
function addDays(iso, d) {
  const dt = new Date(`${iso}T12:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + d);
  return dt.toISOString().slice(0, 10);
}

async function visible(locator, msg, timeout = 15_000) {
  try {
    await locator.filter({ visible: true }).first().waitFor({ state: "visible", timeout });
  } catch {
    throw new Error(`Não ficou visível: ${msg}`);
  }
}
async function hidden(locator, msg, timeout = 15_000) {
  try {
    await locator.first().waitFor({ state: "hidden", timeout });
  } catch {
    throw new Error(`Continuou visível: ${msg}`);
  }
}
async function toast(page, re) {
  await visible(page.locator("[data-sonner-toast]").filter({ hasText: re }), `toast ${re}`);
}
const dialog = (page, name) => page.getByRole("dialog", { name });
/** Rótulo exato de campo (o asterisco de obrigatório entra no texto do <label>). */
const L = (text) => new RegExp(`^${esc(text)}\\s*\\*?$`);

// ---------------------------------------------------------------- navegador / sessão
let browser;
const sessions = {};

async function login(page, who) {
  await page.goto("/login");
  await page.getByLabel(L("E-mail")).fill(who.email);
  await page.getByLabel(L("Senha")).fill(who.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });
}

/** Contexto já autenticado (login feito uma vez por papel; o estado é reaproveitado). */
async function open(who, device = MOBILE) {
  const ctx = await browser.newContext({
    ...device,
    baseURL: BASE_URL,
    locale: "pt-BR",
    timezoneId: "America/Bahia",
    acceptDownloads: true,
    storageState: sessions[who.email],
  });
  ctx.setDefaultTimeout(20_000);
  ctx.setDefaultNavigationTimeout(45_000);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  if (!sessions[who.email]) {
    await login(page, who);
    sessions[who.email] = await ctx.storageState();
  }
  return { ctx, page, errors };
}

// ---------------------------------------------------------------- execução
const results = [];
let current = null;
async function scenario(name, fn) {
  if (process.env.E2E_ONLY && !name.toLowerCase().includes(process.env.E2E_ONLY.toLowerCase())) return;
  const t0 = Date.now();
  const opened = [];
  current = { open: async (...a) => { const o = await open(...a); opened.push(o); return o; } };
  process.stdout.write(`• ${name} … `);
  try {
    await fn(current);
    for (const o of opened) assert(o.errors.length === 0, `erros de JavaScript na página: ${o.errors.join(" | ")}`);
    results.push({ name, ok: true, ms: Date.now() - t0 });
    console.log(`ok (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  } catch (e) {
    results.push({ name, ok: false, ms: Date.now() - t0, error: e });
    console.log("FALHOU");
    console.log(`  ${String(e.stack || e).split("\n").slice(0, 4).join("\n  ")}`);
    for (const [i, o] of opened.entries()) {
      const file = path.join(outDir, `${name.replace(/[^\w]+/g, "_").slice(0, 60)}_${i}.png`);
      await o.page.screenshot({ path: file, fullPage: true }).catch(() => {});
      console.log(`  screenshot: ${path.relative(root, file)} (${o.page.url()})`);
    }
  } finally {
    for (const o of opened) await o.ctx.close().catch(() => {});
  }
}

// ---------------------------------------------------------------- dados da execução
const RUN = Date.now().toString(36).toUpperCase();
const digits = String(Date.now()).slice(-8);
const S = {
  customerName: `E2E Cliente ${RUN}`,
  phone: `749${digits}`, // (74) 9XXXX-XXXX
  cityName: "Cidade E2E",
  productName: `E2E Produto ${RUN}`,
  productPrice: 120,
  customerId: null,
  productId: null,
  saleA: null,
  saleB: null,
  today: null,
};

async function customerRow() {
  const [c] = await sql(`select * from v_customers where id = ${lit(S.customerId)}`);
  return c;
}
async function installmentsB() {
  return sql(`select id, number, amount::float8 amount, paid_amount::float8 paid_amount, remaining::float8 remaining, status,
                     original_due_date::text original_due_date, collection_date::text collection_date, needs_visit,
                     pending_confirmation_amount::float8 pending, is_partial
              from v_installments where sale_id = ${lit(S.saleB.id)} order by number`);
}

// =================================================================== cenários
async function main() {
  browser = await chromium.launch({ headless: process.env.E2E_HEADED !== "1", slowMo: Number(process.env.E2E_SLOWMO || 0) });
  const health = await fetch(`${BASE_URL}/login`).catch(() => null);
  if (!health || !health.ok) throw new Error(`App não responde em ${BASE_URL}/login`);
  [{ today: S.today }] = await sql("select app_today()::text as today");
  console.log(`PLASCOTEL E2E · ${BASE_URL} · execução ${RUN} · hoje ${S.today}\n`);

  // 1 ------------------------------------------------------------------
  await scenario("1. Proprietário: cadastrar, editar, buscar, arquivar e reativar cliente", async ({ open }) => {
    const { page } = await open(OWNER);
    await page.goto("/clientes");
    await page.getByRole("link", { name: "Novo cliente" }).click();
    await page.waitForURL("**/clientes/novo");

    await page.getByLabel(L("Nome completo")).fill(S.customerName);
    await page.getByLabel(L("Telefone")).fill(S.phone);
    assertEq(await page.getByLabel(L("Telefone")).inputValue(), `(74) 9${digits.slice(0, 4)}-${digits.slice(4)}`, "máscara do telefone");
    await page.getByRole("button", { name: "Mesmo do telefone" }).click();
    const city = page.getByLabel(L("Cidade"));
    await city.selectOption("__new__");
    await page.getByLabel(L("Nome da cidade")).fill(S.cityName);
    await page.getByRole("button", { name: "Adicionar cidade" }).click();
    await until(async () => {
      const v = await city.inputValue();
      return v !== "" && v !== "__new__";
    }, "cidade selecionada após cadastro rápido");
    await page.getByLabel(L("Bairro")).fill("Centro");
    await page.getByLabel(L("Endereço")).fill("Rua das Flores, 10");
    await page.getByRole("button", { name: "Cadastrar cliente" }).click();
    await page.waitForURL(/\/clientes\/[0-9a-f-]{36}$/);
    S.customerId = page.url().split("/").pop();
    await visible(page.getByRole("heading", { level: 1, name: S.customerName }), "nome na ficha");
    await visible(page.getByText(`${S.cityName}/BA`), "cidade na ficha");
    let c = await customerRow();
    assertEq(c.phone.replace(/\D/g, ""), S.phone, "telefone salvo no banco");
    assertEq(c.city_name, S.cityName, "cidade salva no banco");

    // Editar
    await page.getByRole("link", { name: "Editar" }).click();
    await page.waitForURL(/\/editar$/);
    await page.getByLabel(L("Bairro")).fill("Bairro Editado");
    await page.getByLabel(L("Ponto de referência")).fill("Casa azul");
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await page.waitForURL(new RegExp(`/clientes/${S.customerId}$`));
    await visible(page.getByText("Bairro Editado"), "bairro editado na ficha");
    c = await customerRow();
    assertEq(c.neighborhood, "Bairro Editado", "bairro editado no banco");
    assertEq(c.reference, "Casa azul", "referência no banco");

    // Buscar por nome e por telefone
    await page.goto("/clientes");
    const search = page.getByPlaceholder("Buscar por nome ou telefone");
    const card = page.getByRole("link", { name: `Abrir ficha de ${S.customerName}` });
    await search.fill(S.customerName.toLowerCase());
    await page.waitForURL(/[?&]q=/);
    await visible(card, "cliente na busca por nome");
    await search.fill(digits);
    await page.waitForURL(new RegExp(`q=${digits}`));
    await visible(card, "cliente na busca por telefone");
    assertEq(await page.getByRole("link", { name: /^Abrir ficha de / }).count(), 1, "busca por telefone retorna só o cliente");

    // Arquivar e reativar
    await card.click();
    await page.waitForURL(new RegExp(`/clientes/${S.customerId}`));
    await page.getByRole("button", { name: "Arquivar cliente" }).click();
    await dialog(page, "Arquivar cliente?").getByRole("button", { name: "Arquivar", exact: true }).click();
    await visible(page.getByText(/Cliente arquivado em/), "aviso de cliente arquivado");
    assert((await customerRow()).archived_at, "archived_at preenchido");
    await page.goto(`/clientes?q=${encodeURIComponent(S.customerName)}`);
    await visible(page.getByText("Nenhum cliente encontrado"), "arquivado some da lista padrão");
    await page.getByRole("button", { name: "Mostrar arquivados" }).click();
    await visible(page.getByRole("link", { name: `Abrir ficha de ${S.customerName}` }), "arquivado aparece com filtro");
    await page.goto(`/clientes/${S.customerId}`);
    await page.getByRole("button", { name: "Reativar cliente" }).click();
    await dialog(page, "Reativar cliente?").getByRole("button", { name: "Reativar", exact: true }).click();
    await hidden(page.getByText(/Cliente arquivado em/), "aviso some após reativar");
    assert(!(await customerRow()).archived_at, "archived_at limpo");
  });

  // 2 ------------------------------------------------------------------
  await scenario("2. Proprietário: criar produto", async ({ open }) => {
    const { page } = await open(OWNER);
    await page.goto("/produtos");
    await page.getByRole("button", { name: "Novo produto" }).first().click();
    const dlg = dialog(page, "Novo produto");
    await dlg.getByLabel(L("Nome")).fill(S.productName);
    await dlg.getByLabel(L("Categoria")).fill("E2E");
    await dlg.getByLabel(L("Preço de venda")).fill(typed(S.productPrice));
    assertEq(await dlg.getByLabel(L("Preço de venda")).inputValue(), "120,00", "máscara do preço");
    await dlg.getByRole("button", { name: "Cadastrar produto" }).click();
    await hidden(dlg, "modal fecha após salvar");
    await visible(page.getByText(S.productName), "produto na lista");
    const [p] = await sql(`select id, price::float8 price, active from products where name = ${lit(S.productName)}`);
    assert(p, "produto no banco");
    assertEq(p.price, S.productPrice, "preço no banco");
    assert(p.active, "produto ativo");
    S.productId = p.id;
  });

  // 3 ------------------------------------------------------------------
  await scenario("3. Proprietário: venda à vista com 2 produtos (desktop) → quitada", async ({ open }) => {
    const { page } = await open(OWNER, DESKTOP);
    await page.goto(`/vendas/nova?cliente=${S.customerId}`);
    await visible(page.getByText(S.customerName), "cliente pré-selecionado");
    const products = page.getByLabel(L("Produto"));
    await products.nth(0).selectOption(S.productId);
    await page.getByRole("button", { name: "Adicionar item" }).click();
    await products.nth(1).selectOption("__avulso");
    await page.getByLabel(L("Descrição do item")).fill("Item avulso E2E");
    await page.getByLabel(L("Valor unitário")).nth(1).fill(typed(30));
    await page.getByRole("button", { name: "À vista", exact: true }).click();
    await visible(page.getByText("Recebido agora"), "opção recebido agora");
    assert(await page.getByRole("checkbox", { name: /Recebido agora/ }).isChecked(), "recebido agora marcado por padrão");
    await page.getByRole("button", { name: "Confirmar venda" }).click();
    await page.waitForURL(/\/vendas\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    S.saleA = { id: page.url().split("/").pop() };
    await visible(page.getByText("Quitada", { exact: true }), "venda quitada no detalhe");
    await visible(page.getByText(/Todo o valor de R\$\s*150,00 foi recebido/), "valor total recebido");
    const [s] = await sql(`select status, total::float8 total, balance::float8 balance from v_sales where id = ${lit(S.saleA.id)}`);
    assertEq(s.status, "paid", "status da venda no banco");
    assertEq(s.total, 150, "total da venda");
    assertEq(s.balance, 0, "saldo zero");
    const [{ n }] = await sql(`select count(*)::int n from sale_items where sale_id = ${lit(S.saleA.id)}`);
    assertEq(n, 2, "2 itens");
  });

  // 4 ------------------------------------------------------------------
  await scenario("4. Proprietário: venda parcelada com desconto, entrada e parcela editada/redistribuída", async ({ open }) => {
    const { page } = await open(OWNER);
    const saleDate = addDays(S.today, -20);
    const due1 = addDays(S.today, -5);
    const due3 = addDays(S.today, 30);
    await page.goto("/vendas/nova");

    // Etapa 1 — cliente pela busca
    await page.getByRole("combobox", { name: "Buscar cliente por nome ou telefone" }).fill(S.customerName);
    await page.getByRole("option", { name: new RegExp(esc(S.customerName)) }).click();
    await visible(page.getByRole("button", { name: "Trocar cliente" }), "cliente selecionado");
    await page.getByLabel(L("Data da venda")).fill(saleDate);
    await page.getByRole("button", { name: "Continuar" }).click();

    // Etapa 2 — itens + desconto
    await visible(page.getByRole("heading", { name: "Produtos" }), "etapa produtos");
    await page.getByLabel(L("Produto")).nth(0).selectOption(S.productId);
    await page.getByLabel(L("Quantidade")).nth(0).fill("2");
    await page.getByRole("button", { name: "Adicionar item" }).click();
    await page.getByLabel(L("Produto")).nth(1).selectOption("__avulso");
    await page.getByLabel(L("Descrição do item")).fill("Kit E2E");
    await page.getByLabel(L("Valor unitário")).nth(1).fill(typed(60));
    await page.getByLabel(L("Desconto geral")).fill(typed(20));
    await visible(page.getByText(brl(280)), "total da venda 280");
    await page.getByRole("button", { name: "Continuar" }).click();

    // Etapa 3 — parcelado
    await visible(page.getByRole("heading", { name: "Pagamento" }), "etapa pagamento");
    await page.getByLabel(L("Entrada")).fill(typed(40));
    await page.getByLabel(L("Forma da entrada")).selectOption("cash");
    assert(await page.getByRole("checkbox", { name: /Entrada recebida agora/ }).isChecked(), "entrada recebida marcada");
    assertEq(await page.getByLabel(L("Nº de parcelas")).inputValue(), "3", "3 parcelas por padrão");
    await page.getByLabel(L("1º vencimento")).fill(due1);
    const amount = (i) => page.getByLabel(L(`Valor da parcela ${i}`));
    await until(async () => (await amount(1).inputValue()) === "80,00", "parcelas iguais de 80");
    await amount(1).fill(typed(100));
    await visible(page.getByText(/Sobram\s*R\$\s*20,00/), "aviso de diferença");
    await page.getByRole("button", { name: "Redistribuir" }).click();
    await visible(page.getByText("Soma das parcelas confere com o valor a parcelar"), "soma confere após redistribuir");
    const values = [await amount(1).inputValue(), await amount(2).inputValue(), await amount(3).inputValue()];
    assertEq(values.join(" | "), "100,00 | 70,00 | 70,00", "redistribuir mantém a parcela editada e divide o restante");
    await page.getByLabel(L("Vencimento da parcela 2")).fill(S.today);
    await page.getByLabel(L("Vencimento da parcela 3")).fill(due3);
    await page.getByRole("button", { name: "Continuar" }).click();

    // Etapa 4 — revisão
    await visible(page.getByRole("heading", { name: "Revisão" }), "etapa revisão");
    await page.getByRole("button", { name: "Confirmar venda" }).click();
    await page.waitForURL(/\/vendas\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    S.saleB = { id: page.url().split("/").pop() };

    // Detalhe da venda
    const [s] = await sql(`select code, status, total::float8 total, discount::float8 discount, down_payment::float8 down,
                                  paid_total::float8 paid, balance::float8 balance, installments_count from v_sales where id = ${lit(S.saleB.id)}`);
    S.saleB.code = s.code;
    assertEq(s.total, 280, "total");
    assertEq(s.discount, 20, "desconto");
    assertEq(s.down, 40, "entrada");
    assertEq(s.paid, 40, "entrada recebida");
    assertEq(s.balance, 240, "saldo");
    assertEq(s.installments_count, 3, "3 parcelas");
    await visible(page.getByText("Saldo restante"), "saldo restante no detalhe");
    await visible(page.getByText(brl(240)), "saldo 240 no detalhe");
    await visible(page.getByText("Parcelas (4)"), "entrada + 3 parcelas listadas");
    const cards = page.locator("section[aria-labelledby=parcelas-title] .md\\:hidden > *");
    await visible(cards.filter({ hasText: "Parcela 1/3" }).filter({ hasText: brl(100) }), "parcela 1 = 100");
    await visible(cards.filter({ hasText: "Parcela 2/3" }).filter({ hasText: brl(70) }), "parcela 2 = 70");
    await visible(cards.filter({ hasText: "Parcela 3/3" }).filter({ hasText: brl(70) }), "parcela 3 = 70");
    await visible(cards.filter({ hasText: "Entrada" }).filter({ hasText: "Paga" }), "entrada paga");
    await visible(cards.filter({ hasText: "Parcela 1/3" }).filter({ hasText: "Atrasada" }), "parcela 1 atrasada");

    const inst = await installmentsB();
    assertEq(inst.map((i) => `${i.number}:${i.amount}:${i.collection_date}:${i.status}`).join(" "),
      `0:40:${saleDate}:paid 1:100:${due1}:overdue 2:70:${S.today}:due_today 3:70:${due3}:upcoming`, "parcelas no banco");
  });

  // 5 ------------------------------------------------------------------
  await scenario("5. Funcionário: pagamento parcial em dinheiro confirmado na central de cobranças", async ({ open }) => {
    const { page } = await open(EMPLOYEE);
    await page.goto(`/cobrancas?aba=hoje&q=${encodeURIComponent(S.customerName)}`);
    const card = page.locator("article").filter({ hasText: S.customerName }).filter({ hasText: "Parcela 2" });
    await visible(card, "parcela 2 em Cobrar hoje");
    await card.getByRole("button", { name: "Receber", exact: true }).click();
    const dlg = dialog(page, "Registrar recebimento");
    await visible(dlg, "diálogo de recebimento");
    await dlg.getByLabel(L("Valor recebido")).fill(typed(30));
    await dlg.getByRole("radio", { name: "Dinheiro" }).click();
    assert(await dlg.getByRole("checkbox", { name: /Recebimento confirmado/ }).isChecked(), "dinheiro => confirmado");
    await visible(dlg.getByText("Pagamento parcial — o restante continua em cobrança."), "aviso de parcial");
    await dlg.getByRole("button", { name: /Receber\s*R\$\s*30,00/ }).click();
    await visible(dlg.getByText(/R\$\s*30,00 recebidos\. Restam R\$\s*40,00/), "sucesso com saldo restante");
    await hidden(dlg, "diálogo fecha sozinho");
    await visible(card.getByText("Parcial"), "selo parcial no card");
    await visible(card.getByText(/de R\$\s*70,00/), "valor original no card");
    await until(async () => /R\$\s*40,00/.test(await card.innerText()), "restante 40 no card");
    const p2 = (await installmentsB())[2];
    assertEq(n2(p2.remaining), 40, "restante da parcela 2 no banco");
    assertEq(p2.status, "due_today", "continua para cobrar hoje");
    assert(p2.is_partial, "marcada como parcial");
    const [pay] = await sql(`select status, method, amount::float8 amount from payments where installment_id = ${lit(p2.id)}`);
    assertEq(`${pay.status}/${pay.method}/${pay.amount}`, "confirmed/cash/30", "pagamento no banco");
  });

  // 6 ------------------------------------------------------------------
  await scenario("6. Funcionário: Pix com comprovante a confirmar → comprovante abre → confirmar", async ({ open }) => {
    const pngPath = path.join(outDir, "comprovante-e2e.png");
    fs.writeFileSync(pngPath, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
    const { page, ctx } = await open(EMPLOYEE);
    await page.goto(`/cobrancas?aba=proximas&q=${encodeURIComponent(S.customerName)}`);
    const card = page.locator("article").filter({ hasText: S.customerName }).filter({ hasText: "Parcela 3" });
    await visible(card, "parcela 3 em Próximas");
    await card.getByRole("button", { name: "Receber", exact: true }).click();
    const dlg = dialog(page, "Registrar recebimento");
    await dlg.getByLabel(L("Valor recebido")).fill(typed(50));
    await dlg.getByRole("radio", { name: "Pix" }).click();
    await dlg.getByLabel(/Comprovante/).setInputFiles(pngPath);
    await visible(dlg.getByText("comprovante-e2e.png"), "arquivo anexado");
    const confirmBox = dlg.getByRole("checkbox", { name: /Recebimento confirmado/ });
    assert(!(await confirmBox.isChecked()), "Pix com comprovante não é confirmado por padrão");
    await dlg.getByRole("button", { name: "Registrar para conferência" }).click();
    await visible(dlg.getByText(/aguardando confirmação na aba/), "sucesso aguardando confirmação");
    await hidden(dlg, "diálogo fecha");

    const p3 = (await installmentsB())[3];
    assertEq(n2(p3.pending), 50, "valor pendente na parcela 3");
    assertEq(n2(p3.remaining), 70, "saldo não muda antes de confirmar");

    await page.goto(`/cobrancas?aba=confirmar&q=${encodeURIComponent(S.customerName)}`);
    const pcard = page.locator("article").filter({ hasText: S.customerName });
    await visible(pcard.getByText("A confirmar"), "pagamento em A confirmar");
    await visible(pcard.getByText(brl(50)), "valor informado 50");
    await pcard.getByRole("button", { name: "Comprovantes (1)" }).click();
    const rdlg = dialog(page, "Comprovantes");
    const fileBtn = rdlg.getByRole("button", { name: /comprovante-e2e\.png/ });
    await visible(fileBtn, "comprovante listado");
    const popupP = ctx.waitForEvent("page");
    await fileBtn.click();
    const popup = await popupP;
    await popup.waitForURL(/\/storage\/v1\/object\/sign\/receipts\//, { timeout: 20_000 });
    const signedUrl = popup.url();
    const res = await fetch(signedUrl);
    assertEq(res.status, 200, "URL assinada do comprovante responde 200");
    assert((res.headers.get("content-type") || "").includes("image/png"), "comprovante é PNG");
    await popup.close();
    await rdlg.getByRole("button", { name: "Fechar" }).click();
    await hidden(rdlg, "fecha comprovantes");

    await pcard.getByRole("button", { name: "Confirmar", exact: true }).click();
    await dialog(page, "Confirmar recebimento?").getByRole("button", { name: "Confirmar recebimento" }).click();
    await toast(page, /confirmad/i);
    await visible(page.getByText("Nada encontrado com esses filtros"), "some de A confirmar");
    const after = (await installmentsB())[3];
    assertEq(n2(after.remaining), 20, "baixa aplicada na parcela 3");
    assertEq(n2(after.pending), 0, "nada pendente");
    const [{ n }] = await sql(`select count(*)::int n from payment_receipts r join payments p on p.id = r.payment_id where p.installment_id = ${lit(after.id)}`);
    assertEq(n, 1, "comprovante registrado no banco");
  });

  // 7 ------------------------------------------------------------------
  await scenario("7. Funcionário: adiar parcela (nova data, motivo, visita) → Adiadas e histórico", async ({ open }) => {
    const { page } = await open(EMPLOYEE);
    const newDate = addDays(S.today, 10);
    const reason = `Pediu mais prazo ${RUN}`;
    const q = encodeURIComponent(S.customerName);
    await page.goto(`/cobrancas?aba=atrasadas&q=${q}`);
    const card = page.locator("article").filter({ hasText: S.customerName }).filter({ hasText: "Parcela 1" });
    await visible(card, "parcela 1 em Atrasadas");
    await card.getByRole("button", { name: "Adiar cobrança" }).click();
    const dlg = dialog(page, "Adiar cobrança");
    await dlg.getByLabel(L("Nova data de cobrança")).fill(newDate);
    await dlg.getByLabel(L("Motivo")).fill(reason);
    const visit = dlg.getByRole("checkbox", { name: /Precisa de visita presencial/ });
    if (!(await visit.isChecked())) await visit.check();
    await dlg.getByRole("button", { name: "Adiar cobrança", exact: true }).click();
    await visible(dlg.getByText(new RegExp(`Nova data de cobrança: .*\\(${esc(fmtDate(newDate))}\\)`)), "sucesso do adiamento");
    await hidden(dlg, "diálogo fecha");

    await page.goto(`/cobrancas?aba=atrasadas&q=${q}`);
    await visible(page.getByText("Nada encontrado com esses filtros"), "saiu de Atrasadas");
    await page.goto(`/cobrancas?aba=hoje&q=${q}`);
    await visible(page.locator("article").filter({ hasText: "Parcela 2" }), "parcela 2 continua em hoje");
    assertEq(await page.locator("article").filter({ hasText: "Parcela 1" }).count(), 0, "parcela 1 não está em hoje");
    await page.goto(`/cobrancas?aba=adiadas&q=${q}`);
    const adiada = page.locator("article").filter({ hasText: "Parcela 1" });
    await visible(adiada, "parcela 1 em Adiadas");
    await visible(adiada.getByText(new RegExp(`adiada 1x · venc\\. ${esc(fmtDate(addDays(S.today, -5)))}`)), "vencimento original no card");
    await visible(adiada.getByText(fmtDate(newDate)), "nova data no card");
    await visible(adiada.getByText("Visita"), "selo de visita");

    const p1 = (await installmentsB())[1];
    assertEq(p1.original_due_date, addDays(S.today, -5), "vencimento original preservado");
    assertEq(p1.collection_date, newDate, "nova data de cobrança");
    assert(p1.needs_visit, "precisa de visita");
    assertEq(p1.status, "postponed", "status adiada");

    await page.goto(`/clientes/${S.customerId}?aba=historico`);
    await visible(page.getByText(new RegExp(esc(reason))), "adiamento no histórico do cliente");
    await page.goto(`/clientes/${S.customerId}?aba=financeiro`);
    await visible(page.getByText(new RegExp(esc(reason))), "adiamento na aba financeiro");
  });

  // 8 ------------------------------------------------------------------
  await scenario("8. Funcionário: registrar promessa → aparece na ficha, saldo inalterado", async ({ open }) => {
    const { page } = await open(EMPLOYEE);
    const before = n2((await customerRow()).balance);
    await page.goto(`/clientes/${S.customerId}`);
    await page.getByRole("button", { name: "Promessa", exact: true }).click();
    const dlg = dialog(page, "Registrar promessa");
    await visible(dlg.getByText("Promessa não é pagamento"), "aviso da promessa");
    await dlg.getByLabel(L("Valor prometido")).fill(typed(25));
    await dlg.getByLabel(L("Observação")).fill(`Promessa ${RUN}`);
    await dlg.getByRole("button", { name: "Registrar promessa" }).click();
    await visible(dlg.getByText("Promessa registrada"), "sucesso");
    await hidden(dlg, "diálogo fecha");
    await page.goto(`/clientes/${S.customerId}?aba=financeiro`);
    await visible(page.getByText("Promessas", { exact: true }), "seção de promessas");
    await visible(page.getByText(brl(25)), "promessa de 25 na ficha");
    await visible(page.getByText(`Promessa ${RUN}`), "observação da promessa na ficha");
    const [pr] = await sql(`select amount::float8 amount, status from v_promises where customer_id = ${lit(S.customerId)} order by created_at desc limit 1`);
    assertEq(pr.amount, 25, "promessa no banco");
    assertEq(n2((await customerRow()).balance), before, "saldo não muda com promessa");
  });

  // 9 ------------------------------------------------------------------
  await scenario("9. Funcionário: observação, visita agendada, cliente visitado e visita realizada", async ({ open }) => {
    const { page } = await open(EMPLOYEE);
    const note = `Observação E2E ${RUN}`;
    await page.goto(`/clientes/${S.customerId}`);
    await page.getByRole("button", { name: "Observação" }).click();
    const ndlg = dialog(page, "Nova observação");
    await ndlg.getByLabel(L("Texto")).fill(note);
    await ndlg.getByRole("button", { name: "Registrar" }).click();
    await toast(page, /Observação registrada/);
    await hidden(ndlg, "diálogo de observação fecha");
    await page.goto(`/clientes/${S.customerId}?aba=observacoes`);
    await visible(page.getByText(note), "observação na aba");

    await page.goto("/agenda");
    await page.getByRole("button", { name: "Nova visita" }).first().click();
    const vdlg = dialog(page, "Agendar visita");
    const citySel = vdlg.getByLabel(L("Cidade"));
    const cityValue = await citySel.locator("option", { hasText: `${S.cityName}/BA` }).getAttribute("value");
    await citySel.selectOption(cityValue);
    await vdlg.getByLabel(L("Observações")).fill(`Rota E2E ${RUN}`);
    const box = vdlg.getByRole("checkbox", { name: new RegExp(esc(S.customerName)) });
    await until(async () => (await vdlg.getByText(/Sugeridos para visita/).count()) > 0, "candidatos carregados");
    if ((await box.count()) === 0) await vdlg.getByRole("button", { name: /Adicionar outros clientes/ }).click();
    await visible(box, "cliente na lista de candidatos");
    if (!(await box.isChecked())) await box.check();
    await vdlg.getByRole("button", { name: /^Agendar com \d+ clientes?$/ }).click();
    await page.waitForURL(/\/agenda\/[0-9a-f-]{36}/, { timeout: 30_000 });
    const visitId = page.url().split("/").pop().split("?")[0];

    const ccard = page.locator("article").filter({ has: page.getByRole("link", { name: S.customerName }) });
    await visible(ccard, "cliente na visita");
    await ccard.getByRole("radio", { name: "Visitado" }).click();
    await toast(page, /visitado/i);
    await until(async () => (await ccard.getByRole("radio", { name: "Visitado" }).getAttribute("aria-checked")) === "true", "cliente marcado como visitado");
    await page.getByRole("button", { name: "Marcar como realizada" }).click();
    await dialog(page, "Marcar visita como realizada?").getByRole("button", { name: "Marcar como realizada" }).click();
    await visible(page.getByRole("button", { name: "Reabrir visita" }), "visita realizada");
    const [v] = await sql(`select v.status, vc.status as cstatus from visits v join visit_customers vc on vc.visit_id = v.id
                           where v.id = ${lit(visitId)} and vc.customer_id = ${lit(S.customerId)}`);
    assertEq(`${v.status}/${v.cstatus}`, "done/visited", "visita e cliente no banco");
    const [{ n }] = await sql(`select count(*)::int n from customer_notes where customer_id = ${lit(S.customerId)} and body = ${lit(note)}`);
    assertEq(n, 1, "observação no banco");
  });

  // 10 -----------------------------------------------------------------
  await scenario("10. Funcionário: rotas e ações de proprietário bloqueadas", async ({ open }) => {
    const { page } = await open(EMPLOYEE);
    for (const route of ["/caixa", "/relatorios", "/configuracoes", "/vendas/nova", `/clientes/${S.customerId}/editar`, "/clientes/novo"]) {
      await page.goto(route);
      await until(() => new URL(page.url()).pathname === "/", `${route} redireciona para o início`);
      assert(page.url().includes("acesso=negado"), `${route} sinaliza acesso negado`);
    }
    const res = await page.request.get(`/api/export/resumo?periodo=custom&de=${S.today}&ate=${S.today}`);
    assertEq(res.status(), 403, "exportação negada ao funcionário");

    await page.goto(`/vendas/${S.saleB.id}`);
    await visible(page.getByText("Pagamentos (", { exact: false }), "detalhe da venda carrega");
    assertEq(await page.getByRole("button", { name: "Cancelar venda" }).count(), 0, "sem botão cancelar venda");
    assertEq(await page.getByRole("button", { name: "Estornar" }).count(), 0, "sem botão estornar");
    await page.goto(`/clientes/${S.customerId}`);
    await visible(page.getByRole("heading", { level: 1, name: S.customerName }), "ficha carrega");
    for (const name of ["Arquivar cliente", "Registrar venda", "Editar"]) {
      assertEq(await page.getByRole("button", { name }).or(page.getByRole("link", { name })).count(), 0, `sem "${name}"`);
    }
    await page.getByRole("button", { name: "Abrir menu" }).click();
    const menu = dialog(page, "Menu principal");
    await visible(menu, "menu");
    for (const name of ["Caixa", "Relatórios", "Configurações"]) {
      assertEq(await menu.getByRole("link", { name }).count(), 0, `menu sem ${name}`);
    }
  });

  // 11 -----------------------------------------------------------------
  await scenario("11. Proprietário: estorno com justificativa, caixa do dia, ajuste e conferência", async ({ open }) => {
    const { page } = await open(OWNER, DESKTOP);
    const justification = `Estorno E2E ${RUN} lançado errado`;
    await page.goto(`/vendas/${S.saleB.id}`);
    await visible(page.getByText(brl(160)), "saldo 160 antes do estorno");
    const row = page.locator("section[aria-labelledby=pagamentos-title] tr").filter({ hasText: "Parcela 2" }).filter({ hasText: "Dinheiro" });
    await visible(row, "pagamento da parcela 2 na tabela");
    await row.getByRole("button", { name: "Estornar" }).click();
    const dlg = dialog(page, "Estornar pagamento");
    const confirmBtn = dlg.getByRole("button", { name: "Estornar", exact: true });
    await dlg.getByLabel(L("Justificativa do estorno")).fill("abc");
    assert(await confirmBtn.isDisabled(), "justificativa curta bloqueia o estorno");
    await dlg.getByLabel(L("Justificativa do estorno")).fill(justification);
    await confirmBtn.click();
    await toast(page, /estornad/i);
    await visible(row.getByText("Estornado"), "pagamento estornado na tabela");
    await until(async () => (await page.locator("p.money").first().innerText()).match(/R\$\s*190,00/), "saldo volta para 190");
    const [s] = await sql(`select balance::float8 balance from v_sales where id = ${lit(S.saleB.id)}`);
    assertEq(s.balance, 190, "saldo da venda no banco");
    assertEq(n2((await installmentsB())[2].remaining), 70, "parcela 2 volta a 70");

    await page.goto("/caixa");
    const mov = page.getByText(new RegExp(`Estorno venda #${S.saleB.code}`));
    await visible(mov, "estorno nas movimentações do dia");

    // Ajuste de caixa (hoje)
    const adj = `Ajuste E2E ${RUN}`;
    await page.getByRole("button", { name: "Ajuste de caixa" }).click();
    const adlg = dialog(page, "Ajuste de caixa");
    await adlg.getByRole("radio", { name: "Entrada" }).click();
    await adlg.getByLabel(L("Valor")).fill(typed(10));
    await adlg.getByLabel(L("Justificativa")).fill(adj);
    await adlg.getByRole("button", { name: /Registrar entrada/ }).click();
    await toast(page, /Entrada registrada no caixa/);
    await visible(page.getByText(adj), "ajuste nas movimentações");
    const [m] = await sql(`select kind, amount::float8 amount, occurred_on::text d from cash_movements where description = ${lit(adj)}`);
    assertEq(`${m.kind}/${m.amount}/${m.d}`, `adjustment/10/${S.today}`, "ajuste no banco");

    // Conferência: dia passado sem movimentos nem conferência (não trava o caixa de hoje nas próximas execuções).
    const [{ d }] = await sql(`select g::date::text d from generate_series(app_today() - 60, app_today() - 1000, interval '-1 day') g
                               where not exists (select 1 from cash_closings where closing_date = g::date)
                                 and not exists (select 1 from cash_movements where occurred_on = g::date) limit 1`);
    await page.goto(`/caixa?data=${d}`);
    await page.getByRole("button", { name: "Conferir caixa do dia" }).click();
    const cdlg = dialog(page, `Conferir caixa de ${fmtDate(d)}`);
    await visible(cdlg.getByText("Sem divergência"), "sem divergência com 0 esperado");
    await cdlg.getByLabel(L("Observações")).fill(`Conferência E2E ${RUN}`);
    await cdlg.getByRole("button", { name: "Confirmar conferência" }).click();
    await toast(page, /conferid/i);
    await visible(page.getByText("Caixa conferido"), "card de caixa conferido");
    const [cl] = await sql(`select notes from cash_closings where closing_date = ${lit(d)}`);
    assertEq(cl?.notes, `Conferência E2E ${RUN}`, "conferência no banco");
  });

  // 12 -----------------------------------------------------------------
  await scenario("12. Proprietário: relatórios com período personalizado e exportação CSV", async ({ open }) => {
    const { page } = await open(OWNER);
    const from = addDays(S.today, -30);
    await page.goto("/relatorios");
    // Clique antes da hidratação não tem efeito (página com streaming): repete até o formulário abrir.
    await until(async () => {
      await page.getByRole("button", { name: "Personalizado" }).click();
      await page.getByLabel(L("De")).waitFor({ timeout: 2000 });
    }, "formulário de período personalizado");
    await page.getByLabel(L("De")).fill(from);
    await page.getByLabel(L("Até")).fill(S.today);
    await page.getByRole("button", { name: "Aplicar" }).click();
    await page.waitForURL(new RegExp(`periodo=custom.*de=${from}.*ate=${S.today}|periodo=custom.*ate=${S.today}.*de=${from}`));
    await visible(page.getByText(`Período: ${fmtDate(from)} a ${fmtDate(S.today)}`), "descrição do período");
    await visible(page.getByText("Total vendido"), "indicadores carregam");
    await visible(page.getByText("Total recebido"), "total recebido");
    assertEq(await page.getByText(/indisponíve/).count(), 0, "nenhuma seção com erro");

    await page.getByRole("button", { name: "Exportar" }).click();
    const dlg = dialog(page, "Exportar planilhas");
    const downloadP = page.waitForEvent("download");
    await dlg.getByRole("button", { name: /Vendas do período/ }).click();
    const download = await downloadP;
    const file = path.join(outDir, download.suggestedFilename());
    await download.saveAs(file);
    const buf = fs.readFileSync(file);
    assert(buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf, "CSV começa com BOM UTF-8");
    const text = buf.toString("utf8").slice(1);
    const header = text.split(/\r?\n/)[0];
    assert(header.includes(";"), `cabeçalho separado por ";" (${header})`);
    assert(!header.includes(","), "cabeçalho sem vírgula como separador");
    assert(text.includes(String(S.saleB.code)), "venda criada no CSV");
    await toast(page, /Arquivo gerado/);

    for (const kind of ["resumo", "cidades", "inadimplencia", "caixa"]) {
      const res = await page.request.get(`/api/export/${kind}?periodo=custom&de=${from}&ate=${S.today}`);
      assertEq(res.status(), 200, `export ${kind} status`);
      assert((res.headers()["content-type"] || "").includes("text/csv"), `export ${kind} content-type`);
      const b = await res.body();
      assert(b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf, `export ${kind} com BOM`);
      assert(b.toString("utf8").split(/\r?\n/)[0].includes(";"), `export ${kind} com ";"`);
    }
  });

  // 13 -----------------------------------------------------------------
  await scenario("13. Busca global (Ctrl+K e botão) e notificações", async ({ open }) => {
    {
      const { page } = await open(OWNER, DESKTOP);
      await page.goto("/");
      await page.keyboard.press("Control+k");
      const dlg = dialog(page, "Busca global");
      await visible(dlg, "busca abre com Ctrl+K");
      await dlg.getByRole("combobox", { name: "Buscar" }).fill(S.customerName);
      await dlg.getByRole("button", { name: new RegExp(esc(S.customerName)) }).first().click();
      await page.waitForURL(new RegExp(`/clientes/${S.customerId}`));
      await hidden(dlg, "busca fecha ao navegar");
      await page.getByRole("button", { name: /^Notificações/ }).click();
      await visible(dialog(page, "Notificações"), "painel de notificações");
    }
    {
      const { page } = await open(EMPLOYEE);
      await page.goto("/cobrancas");
      await page.getByRole("button", { name: "Buscar clientes, vendas, cidades" }).click();
      const dlg = dialog(page, "Busca global");
      await dlg.getByRole("combobox", { name: "Buscar" }).fill(digits);
      await dlg.getByRole("button", { name: new RegExp(esc(S.customerName)) }).first().click();
      await page.waitForURL(new RegExp(`/clientes/${S.customerId}`));
      await page.getByRole("button", { name: /^Notificações/ }).click();
      await visible(dialog(page, "Notificações"), "painel de notificações (celular)");
    }
  });

  // 14 -----------------------------------------------------------------
  await scenario("14. Menu mobile abre, navega e fecha sozinho", async ({ open }) => {
    const { page } = await open(OWNER);
    await page.goto("/");
    const menu = dialog(page, "Menu principal");
    await page.getByRole("button", { name: "Abrir menu" }).click();
    await visible(menu, "menu abre");
    await menu.getByRole("link", { name: "Clientes" }).click();
    await page.waitForURL("**/clientes");
    await hidden(menu, "menu fecha ao navegar");
    await page.getByRole("button", { name: "Abrir menu" }).click();
    await visible(menu, "menu reabre");
    await menu.getByRole("link", { name: "Clientes" }).click();
    await hidden(menu, "menu fecha ao tocar na página atual");
    await page.getByRole("button", { name: "Abrir menu" }).click();
    await page.keyboard.press("Escape");
    await hidden(menu, "ESC fecha o menu");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert(overflow <= 0, `sem rolagem horizontal (${overflow}px)`);
  });

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} cenários passaram.`);
  if (failed.length) {
    for (const f of failed) console.log(`  ✗ ${f.name}: ${f.error.message.split("\n")[0]}`);
    process.exitCode = 1;
  }
}

main().catch(async (e) => {
  console.error(e);
  await browser?.close().catch(() => {});
  process.exitCode = 1;
});
