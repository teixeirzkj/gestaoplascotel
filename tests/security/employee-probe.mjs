#!/usr/bin/env node
// Teste de invasão como FUNCIONÁRIO LOGADO (ambiente de desenvolvimento): tenta escalar privilégios
// chamando a API do Supabase diretamente com o JWT real, contornando a interface.
// Toda tentativa abaixo deve ser NEGADA. Uso: node tests/security/employee-probe.mjs
import fs from "node:fs";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const SB = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const [email, password] = env.DEMO_EMPLOYEE.split(" ");
const [ownerEmail] = env.DEMO_OWNER.split(" ");

const auth = await (await fetch(`${SB}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) })).json();
if (!auth.access_token) throw new Error("login do funcionário falhou: " + JSON.stringify(auth));
const me = auth.user.id;
const H = { apikey: KEY, Authorization: `Bearer ${auth.access_token}`, "Content-Type": "application/json" };
const results = [];
const check = (name, pass, detail = "") => results.push({ name, pass, detail });
const rest = (path, init = {}) => fetch(`${SB}/rest/v1/${path}`, { ...init, headers: { ...H, Prefer: "return=representation", ...(init.headers || {}) } });
const rows = async (r) => { const t = await r.text(); try { return JSON.parse(t); } catch { return t; } };
/** Sucesso do atacante = resposta 2xx com linhas afetadas. */
const denied = async (r) => { const b = await rows(r); return { ok: !r.ok || (Array.isArray(b) && b.length === 0), detail: `${r.status} ${JSON.stringify(b).slice(0, 90)}` }; };

const one = async (table, q = "") => (await rows(await rest(`${table}?select=*&limit=1${q}`)))[0];
const owner = await one("profiles", `&email=eq.${encodeURIComponent(ownerEmail)}`);
const vi = await one("v_installments", "&status=in.(upcoming,overdue,due_today,postponed)");
const inst = vi ? await one("installments", `&id=eq.${vi.id}`) : null;
const pay = await one("payments", "&status=eq.confirmed");
const sale = await one("sales", "&status=eq.open");
const cust = await one("customers");
const vcPaid = await one("visit_customers", "&status=neq.to_visit");
const log = await one("activity_logs");

// --- Escalada de privilégio no perfil
let r = await rest(`profiles?id=eq.${me}`, { method: "PATCH", body: JSON.stringify({ role: "owner" }) });
let d = await denied(r); check("funcionário se promover a proprietário", d.ok, d.detail);
if (owner) { r = await rest(`profiles?id=eq.${owner.id}`, { method: "PATCH", body: JSON.stringify({ active: false }) }); d = await denied(r); check("funcionário desativar o proprietário", d.ok, d.detail); }
if (owner) { r = await rest(`profiles?id=eq.${owner.id}`, { method: "PATCH", body: JSON.stringify({ full_name: "Hackeado" }) }); d = await denied(r); check("funcionário alterar nome de outro usuário", d.ok, d.detail); }

// --- Cadastros exclusivos do proprietário
for (const [t, row] of [["customers", { full_name: "Invasor" }], ["products", { name: "Invasor", price: 1 }], ["cities", { name: "Invasorlândia", state: "BA" }]]) {
  r = await rest(t, { method: "POST", body: JSON.stringify(row) }); d = await denied(r); check(`funcionário criar ${t}`, d.ok, d.detail);
}
if (cust) {
  r = await rest(`customers?id=eq.${cust.id}`, { method: "PATCH", body: JSON.stringify({ full_name: "Alterado por invasor" }) }); d = await denied(r); check("funcionário editar cliente", d.ok, d.detail);
  r = await rest(`customers?id=eq.${cust.id}`, { method: "DELETE" }); d = await denied(r); check("funcionário excluir cliente", d.ok, d.detail);
}

// --- Tabelas financeiras: escrita direta proibida (somente RPC)
if (inst) { r = await rest(`installments?id=eq.${inst.id}`, { method: "PATCH", body: JSON.stringify({ paid_amount: inst.amount }) }); d = await denied(r); check("dar baixa direto na parcela", d.ok, d.detail); }
if (pay) { r = await rest(`payments?id=eq.${pay.id}`, { method: "PATCH", body: JSON.stringify({ amount: 0.01 }) }); d = await denied(r); check("alterar valor de pagamento", d.ok, d.detail); }
if (pay) { r = await rest(`payments?id=eq.${pay.id}`, { method: "DELETE" }); d = await denied(r); check("apagar pagamento confirmado", d.ok, d.detail); }
if (sale) { r = await rest(`sales?id=eq.${sale.id}`, { method: "PATCH", body: JSON.stringify({ status: "paid" }) }); d = await denied(r); check("marcar venda como quitada direto", d.ok, d.detail); }
r = await rest("cash_movements", { method: "POST", body: JSON.stringify({ kind: "adjustment", amount: 9999, method: "cash", occurred_on: "2026-01-01", description: "invasor" }) }); d = await denied(r); check("lançar no caixa direto", d.ok, d.detail);
r = await rest("sales", { method: "POST", body: JSON.stringify({ customer_id: cust?.id, subtotal: 1, total: 1 }) }); d = await denied(r); check("criar venda direto", d.ok, d.detail);

// --- Auditoria imutável
if (log) {
  r = await rest(`activity_logs?id=eq.${log.id}`, { method: "PATCH", body: JSON.stringify({ summary: "apagando rastros" }) }); d = await denied(r); check("alterar log de auditoria", d.ok, d.detail);
  r = await rest(`activity_logs?id=eq.${log.id}`, { method: "DELETE" }); d = await denied(r); check("apagar log de auditoria", d.ok, d.detail);
}
r = await rest("activity_logs", { method: "POST", body: JSON.stringify({ action: "fake", entity_type: "x", summary: "log falso" }) }); d = await denied(r); check("forjar log de auditoria", d.ok, d.detail);

// --- Configurações
r = await rest("app_settings?key=eq.company", { method: "PATCH", body: JSON.stringify({ value: { name: "pwn" } }) }); d = await denied(r); check("alterar configurações", d.ok, d.detail);

// --- RPCs exclusivas do proprietário
const z = "00000000-0000-0000-0000-000000000000";
for (const [fn, args] of [
  ["create_sale", { p: { customer_id: cust?.id, idempotency_key: crypto.randomUUID(), items: [{ description: "x", quantity: 1, unit_price: 1 }] } }],
  ["cancel_sale", { p_sale_id: sale?.id ?? z, p_reason: "invasao teste" }],
  ["reverse_payment", { p_payment_id: pay?.id ?? z, p_reason: "invasao teste" }],
  ["cash_adjustment", { p_amount: 500, p_method: "cash", p_date: "2026-01-01", p_justification: "invasao teste" }],
  ["close_cash_day", { p_date: "2020-01-01", p_counted_cash: 0, p_notes: "x" }],
]) {
  r = await fetch(`${SB}/rest/v1/rpc/${fn}`, { method: "POST", headers: H, body: JSON.stringify(args) });
  const b = await r.text();
  check(`RPC de proprietário ${fn}`, !r.ok && /42501|propriet/i.test(b), `${r.status} ${b.slice(0, 90)}`);
}
for (const fn of ["log_activity", "_apply_payment_confirmation", "_refresh_sale_status", "handle_new_user", "audit_row", "guard_profile_update"]) {
  r = await fetch(`${SB}/rest/v1/rpc/${fn}`, { method: "POST", headers: H, body: "{}" });
  check(`função interna ${fn} não executável`, !r.ok, `${r.status}`);
}

// --- Falsificação de identidade
r = await rest("customer_notes", { method: "POST", body: JSON.stringify({ customer_id: cust?.id, body: "nota forjada", created_by: owner?.id }) }); d = await denied(r); check("criar observação em nome de outro usuário", d.ok, d.detail);
r = await rest("notification_reads", { method: "POST", body: JSON.stringify({ user_id: owner?.id, notification_key: "x" }) }); d = await denied(r); check("marcar notificação de outro usuário", d.ok, d.detail);
const otherReads = await rows(await rest(`notification_reads?user_id=neq.${me}&limit=5`));
check("ler notificações de outros usuários", Array.isArray(otherReads) && otherReads.length === 0, JSON.stringify(otherReads).slice(0, 80));
if (pay) { r = await rest("payment_receipts", { method: "POST", body: JSON.stringify({ payment_id: pay.id, storage_path: `payments/${pay.id}/nao-existe.pdf`, file_name: "x.pdf", mime_type: "application/pdf", size_bytes: 10, uploaded_by: me }) }); d = await denied(r); check("registrar comprovante sem arquivo real", d.ok, d.detail); }
if (vcPaid) { r = await rest(`visit_customers?id=eq.${vcPaid.id}`, { method: "DELETE" }); d = await denied(r); check("apagar registro de visita já atendida", d.ok, d.detail); }

// --- Storage
const upFake = await fetch(`${SB}/storage/v1/object/receipts/payments/${z}/x.png`, { method: "POST", headers: { apikey: KEY, Authorization: H.Authorization, "Content-Type": "image/png" }, body: "x" });
check("upload em pagamento inexistente", !upFake.ok, `${upFake.status}`);
const upExe = await fetch(`${SB}/storage/v1/object/receipts/payments/${pay?.id ?? z}/malware.html`, { method: "POST", headers: { apikey: KEY, Authorization: H.Authorization, "Content-Type": "text/html" }, body: "<script>alert(1)</script>" });
check("upload de HTML/script como comprovante", !upExe.ok, `${upExe.status}`);
const delObj = await fetch(`${SB}/storage/v1/object/receipts`, { method: "DELETE", headers: H, body: JSON.stringify({ prefixes: [`payments/${pay?.id ?? z}/x.png`] }) });
const delBody = await delObj.text();
check("apagar comprovante", !delObj.ok || delBody.trim() === "[]", `${delObj.status} ${delBody.slice(0, 60)}`);


// --- Mensagens de cobrança
r = await rest("customer_messages", { method: "POST", body: JSON.stringify({ group_id: crypto.randomUUID(), customer_id: cust?.id, kind: "due_today", ref_date: "2026-01-01", status: "sent", installment_id: inst?.id }) }); d = await denied(r); check("gravar registro de mensagem direto (sem RPC)", d.ok, d.detail);
if (inst && cust) {
  const other = (await rows(await rest(`customers?select=id&id=neq.${inst.customer_id}&limit=1`)))[0];
  r = await fetch(`${SB}/rest/v1/rpc/record_customer_message`, { method: "POST", headers: H, body: JSON.stringify({ p_customer_id: other.id, p_kind: "due_today", p_status: "sent", p_body: "x", p_amount: 1, p_installments: [{ id: inst.id, ref_date: "2026-01-01" }], p_promise_id: null, p_payment_id: null, p_ref_date: null, p_skip_reason: null }) });
  const b = await r.text(); check("registrar mensagem com parcela de outro cliente", !r.ok && /não pertence/.test(b), `${r.status} ${b.slice(0, 80)}`);
}

// --- Injeção SQL / filtros
for (const payload of ["'; drop table customers; --", "a%' or '1'='1", "x),(select pg_sleep(5))--", "*"]) {
  const t0 = Date.now();
  r = await fetch(`${SB}/rest/v1/rpc/global_search`, { method: "POST", headers: H, body: JSON.stringify({ p_query: payload }) });
  check(`injeção SQL em global_search: ${payload.slice(0, 22)}`, r.status < 500 && Date.now() - t0 < 4000, `${r.status} ${Date.now() - t0}ms`);
}
const still = await rest("customers?select=id&limit=1");
check("tabela customers intacta após injeções", still.ok, `${still.status}`);

const failed = results.filter((x) => !x.pass);
for (const x of results) console.log(`${x.pass ? "✓" : "✖"} ${x.name}${x.pass ? "" : "  →  " + x.detail}`);
console.log(`\n${results.length - failed.length}/${results.length} defesas OK (funcionário, dev)`);
process.exitCode = failed.length ? 1 : 0;
