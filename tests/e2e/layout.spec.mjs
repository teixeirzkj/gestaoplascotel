#!/usr/bin/env node
// Teste de layout mobile: em cada tela, nenhum elemento do conteúdo pode ultrapassar a largura da tela
// (a menos que esteja dentro de uma área com rolagem horizontal própria, como abas e tabelas).
// Detecta conteúdo CORTADO, que não aparece como rolagem da página. Uso: node tests/e2e/layout.spec.mjs
import fs from "node:fs";
import { chromium } from "playwright";

const APP = process.env.E2E_BASE_URL || "http://localhost:3100";
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const [email, pw] = env.DEMO_OWNER.split(" ");
async function sql(q) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: q }),
  });
  return r.json();
}
const [ids] = await sql(`select
  (select i.customer_id from installments i join sales s on s.id = i.sale_id where s.status = 'open' group by i.customer_id order by count(*) desc limit 1) as customer,
  (select id from sales where status = 'open' order by created_at limit 1) as sale,
  (select id from visits order by visit_date desc limit 1) as visit,
  (select id from cities where not archived order by name limit 1) as city`);

const routes = [
  "/", "/mensagens", "/mensagens?aba=historico", "/cobrancas", "/cobrancas?aba=atrasadas", "/cobrancas?aba=confirmar",
  "/clientes", `/clientes/${ids.customer}`, `/clientes/${ids.customer}?aba=compras`, `/clientes/${ids.customer}?aba=financeiro`,
  `/clientes/${ids.customer}?aba=historico`, `/clientes/${ids.customer}?aba=observacoes`, "/clientes/novo", `/clientes/${ids.customer}/editar`,
  "/vendas", "/vendas/nova", `/vendas/${ids.sale}`, "/produtos", "/agenda", "/agenda?visao=calendario", "/agenda?visao=historico", "/agenda?visao=roteiro",
  `/agenda/${ids.visit}`, "/cidades", `/cidades/${ids.city}`, "/caixa", "/relatorios", "/historico",
  "/configuracoes", "/configuracoes?aba=mensagens", "/configuracoes?aba=usuarios", "/configuracoes?aba=sistema", "/perfil",
];

const browser = await chromium.launch();
let problems = 0;
for (const width of [360, 390]) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 }, locale: "pt-BR" });
  const pg = await ctx.newPage();
  await pg.goto(APP + "/login");
  await pg.fill('input[name="email"]', email);
  await pg.fill('input[name="password"]', pw);
  await Promise.all([pg.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 }), pg.click('button[type="submit"]')]);
  for (const r of routes) {
    await pg.goto(APP + r, { waitUntil: "networkidle" });
    await pg.waitForTimeout(300);
    const offenders = await pg.evaluate(() => {
      const W = document.documentElement.clientWidth;
      const main = document.querySelector("main");
      const out = [];
      for (const el of main.querySelectorAll("*")) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.right <= W + 1) continue;
        let p = el.parentElement, scrollable = false;
        while (p && p !== main) {
          const ox = getComputedStyle(p).overflowX;
          if (ox === "auto" || ox === "scroll") { scrollable = true; break; }
          p = p.parentElement;
        }
        if (!scrollable) out.push(`${el.tagName.toLowerCase()} (borda ${Math.round(rect.right)}px) "${(el.textContent || "").trim().slice(0, 30)}"`);
      }
      return out.slice(0, 3);
    });
    if (offenders.length) {
      problems++;
      console.log(`✖ ${width}px ${r}\n    ${offenders.join("\n    ")}`);
    }
  }
  await ctx.close();
}
await browser.close();
console.log(problems ? `\n${problems} tela(s) com conteúdo cortado` : `\n✓ ${routes.length * 2} verificações: nenhum conteúdo cortado em 360px e 390px`);
process.exitCode = problems ? 1 : 0;
