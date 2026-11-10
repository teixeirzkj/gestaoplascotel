#!/usr/bin/env node
// E2E da fila de mensagens de cobrança (ambiente de DESENVOLVIMENTO).
// Uso: node tests/e2e/messages.spec.mjs   (app em E2E_BASE_URL, padrão http://localhost:3100)
import fs from "node:fs";
import { chromium } from "playwright";

const APP = process.env.E2E_BASE_URL || "http://localhost:3100";
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const [empEmail, empPw] = env.DEMO_EMPLOYEE.split(" ");
const [ownEmail, ownPw] = env.DEMO_OWNER.split(" ");
async function sql(q) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: q }),
  });
  return r.json();
}
const results = [];
const check = (name, pass, detail = "") => { results.push({ name, pass, detail }); console.log(`${pass ? "✓" : "✖"} ${name}${pass ? "" : "  →  " + detail}`); };

const browser = await chromium.launch();
async function login(email, pw, viewport = { width: 390, height: 844 }) {
  const ctx = await browser.newContext({ viewport, locale: "pt-BR" });
  const pg = await ctx.newPage();
  const errors = [];
  pg.on("pageerror", (e) => errors.push(e.message));
  await pg.goto(APP + "/login");
  await pg.fill('input[name="email"]', email);
  await pg.fill('input[name="password"]', pw);
  await Promise.all([pg.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 }), pg.click('button[type="submit"]')]);
  return { ctx, pg, errors };
}

// ---------- Funcionário: fila do dia
const emp = await login(empEmail, empPw);
await emp.pg.goto(APP + "/mensagens", { waitUntil: "networkidle" });
const cards = emp.pg.locator("li:has(a:text('Abrir WhatsApp'))");
const total = await cards.count();
check("fila do dia tem mensagens (dados demo com atrasos)", total > 0, `itens=${total}`);
const overflow = await emp.pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
check("fila sem rolagem horizontal em 390px", overflow <= 1, `overflow=${overflow}`);
const widest = await emp.pg.evaluate(() => Math.max(...[...document.querySelectorAll("main li")].map((el) => el.getBoundingClientRect().right)));
check("cartões cabem na largura da tela (sem conteúdo cortado)", widest <= 390, `borda direita=${Math.round(widest)}px`);

const first = cards.first();
const name = (await first.locator("a[href^='/clientes/']").first().textContent())?.trim();
const waHref = await first.locator("a:text('Abrir WhatsApp')").getAttribute("href");
const text = decodeURIComponent((waHref || "").split("?text=")[1] || "");
check("link abre WhatsApp (wa.me) com o número do cliente", /^https:\/\/wa\.me\/55\d{10,11}\?text=/.test(waHref || ""), waHref?.slice(0, 40));
check("mensagem personalizada traz nome e valor", text.includes(name.split(" ")[0]) && /R\$\s?\d/.test(text), text.slice(0, 80));
check("mensagem traz Pix copia e cola com valor", /000201\S+br\.gov\.bcb\.pix\S+54\d{2}\d+\.\d{2}\S+6304[0-9A-F]{4}/.test(text), "");

// Abrir WhatsApp (popup) -> confirmar envio
const [popup] = await Promise.all([emp.pg.waitForEvent("popup", { timeout: 10000 }).catch(() => null), first.locator("a:text('Abrir WhatsApp')").click()]);
if (popup) await popup.close();
await emp.pg.getByRole("button", { name: "Enviada" }).first().click({ timeout: 10000 });
await emp.pg.waitForTimeout(2500);
const custRow = await sql(`select id from customers where full_name = '${name.replace(/'/g, "''")}' limit 1`);
const cid = custRow[0]?.id;
const logRows = await sql(`select status, kind, channel from customer_messages where customer_id = '${cid}' and created_at > now() - interval '5 minutes'`);
check("envio registrado no banco (customer_messages)", logRows.length > 0 && logRows[0].status === "sent" && logRows[0].channel === "whatsapp_assisted", JSON.stringify(logRows).slice(0, 120));
const act = await sql(`select summary from activity_logs where customer_id = '${cid}' and action = 'message_sent' and occurred_at > now() - interval '5 minutes'`);
check("envio aparece no histórico do cliente", act.length === 1 && /enviada pelo WhatsApp/.test(act[0].summary), JSON.stringify(act).slice(0, 120));
await emp.pg.reload({ waitUntil: "networkidle" });
const stillThere = await emp.pg.locator(`li:has(a:text('Abrir WhatsApp')):has-text("${name}")`).count();
check("cliente sai da fila após o envio (1 mensagem por dia)", stillThere === 0, `ainda na fila=${stillThere}`);

// Pular com motivo
const second = emp.pg.locator("li:has(a:text('Abrir WhatsApp'))").first();
if (await second.count()) {
  const name2 = (await second.locator("a[href^='/clientes/']").first().textContent())?.trim();
  await second.getByRole("button", { name: "Mais opções" }).click();
  await emp.pg.getByRole("button", { name: "Pular esta mensagem" }).click();
  await emp.pg.getByRole("button", { name: "Já falei com o cliente hoje" }).click();
  await emp.pg.getByRole("dialog").getByRole("button", { name: "Pular" }).click();
  await emp.pg.waitForTimeout(2500);
  const sk = await sql(`select status, skip_reason from customer_messages m join customers c on c.id = m.customer_id where c.full_name = '${name2.replace(/'/g, "''")}' and m.created_at > now() - interval '5 minutes'`);
  check("pular registra motivo e tira da fila", sk.some((r) => r.status === "skipped" && /falei/.test(r.skip_reason)), JSON.stringify(sk).slice(0, 120));
}

// Não quer receber (opt-out) e reativação na ficha
const third = emp.pg.locator("li:has(a:text('Abrir WhatsApp'))").first();
if (await third.count()) {
  const name3 = (await third.locator("a[href^='/clientes/']").first().textContent())?.trim();
  await third.getByRole("button", { name: "Mais opções" }).click();
  await emp.pg.getByRole("button", { name: "Cliente não quer receber" }).click();
  await emp.pg.getByRole("button", { name: "Cliente pediu para não receber" }).click();
  await emp.pg.getByRole("dialog").getByRole("button", { name: "Confirmar" }).click();
  await emp.pg.waitForTimeout(2500);
  const oo = await sql(`select id, messages_opt_out from customers where full_name = '${name3.replace(/'/g, "''")}'`);
  check("opt-out gravado no cliente", oo[0]?.messages_opt_out === true, JSON.stringify(oo));
  await emp.pg.goto(`${APP}/clientes/${oo[0].id}`, { waitUntil: "networkidle" });
  const card = emp.pg.locator("text=Não recebe mensagens de cobrança");
  check("ficha mostra que o cliente não recebe mensagens", (await card.count()) > 0, "");
  await emp.pg.getByRole("button", { name: "Reativar" }).click();
  await emp.pg.waitForTimeout(2500);
  const oo2 = await sql(`select messages_opt_out from customers where id = '${oo[0].id}'`);
  check("reativar mensagens na ficha", oo2[0]?.messages_opt_out === false, JSON.stringify(oo2));
}

// Histórico
await emp.pg.goto(APP + "/mensagens?aba=historico", { waitUntil: "networkidle" });
check("histórico lista o envio de hoje", (await emp.pg.locator(`text=${name}`).count()) > 0, "");
check("sem erros de JavaScript (funcionário)", emp.errors.length === 0, emp.errors.join(" | "));

// Funcionário não acessa configurações de mensagens
await emp.pg.goto(APP + "/configuracoes?aba=mensagens", { waitUntil: "networkidle" });
check("funcionário bloqueado nas configurações de mensagens", !emp.pg.url().includes("/configuracoes"), emp.pg.url());
await emp.ctx.close();

// ---------- Proprietário: configurações
const own = await login(ownEmail, ownPw, { width: 1280, height: 900 });
await own.pg.goto(APP + "/configuracoes?aba=mensagens", { waitUntil: "networkidle" });
check("proprietário vê calendário, Pix e textos", (await own.pg.locator("text=Calendário de mensagens").count()) > 0 && (await own.pg.locator("text=Pix nas mensagens").count()) > 0, "");
check("chave Pix reconhecida", (await own.pg.locator("text=Chave reconhecida como chave aleatória").count()) > 0, "");
const prev = await own.pg.locator("text=Prévia (exemplo)").locator("xpath=following-sibling::div").innerText();
check("prévia ao vivo renderiza variáveis", prev.includes("Maria") && prev.includes("R$ 150,00"), prev.slice(0, 60));
await own.pg.getByRole("button", { name: "Salvar configurações" }).click();
await own.pg.waitForTimeout(2000);
check("salvar configurações funciona", (await own.pg.locator("text=Configurações de mensagens salvas").count()) > 0, "");
check("sem erros de JavaScript (proprietário)", own.errors.length === 0, own.errors.join(" | "));
await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} verificações OK`);
process.exitCode = failed.length ? 1 : 0;
