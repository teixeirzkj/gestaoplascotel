import { test } from "node:test";
import assert from "node:assert/strict";
import { computeQueue, type MessageLog, type QueueCustomer, type QueueInstallment } from "../../src/features/messages/queue";
import { DEFAULT_MESSAGE_SETTINGS, renderTemplate, DEFAULT_TEMPLATES } from "../../src/features/messages/config";
import { addDays } from "../../src/lib/dates";

const today = "2026-11-10";
const cust = (id: string, extra: Partial<QueueCustomer> = {}): QueueCustomer => ({ id, full_name: `Cliente ${id}`, phone: "74999990000", city_name: "Jacobina", opt_out: false, balance: 300, ...extra });
const inst = (id: string, customer_id: string, collection_date: string, extra: Partial<QueueInstallment> = {}): QueueInstallment => ({
  id, customer_id, number: 1, sale_code: 10, remaining: 100, pending_confirmation_amount: 0, collection_date, original_due_date: collection_date, ...extra,
});
const run = (installments: QueueInstallment[], logs: MessageLog[] = [], customers = [cust("a"), cust("b"), cust("c")], extra: Partial<Parameters<typeof computeQueue>[0]> = {}) =>
  computeQueue({ today, settings: DEFAULT_MESSAGE_SETTINGS, customers, installments, promises: [], payments: [], logs, ...extra });
const log = (installment_id: string, kind: string, ref_date: string, created_on = "2026-11-01", customer_id = "a"): MessageLog => ({
  customer_id, installment_id, promise_id: null, payment_id: null, kind, ref_date, status: "sent", created_on,
});

test("etapas pela data de cobrança", () => {
  assert.equal(run([inst("1", "a", addDays(today, 3))])[0]?.kind, "before_due");
  assert.equal(run([inst("1", "a", addDays(today, 4))]).length, 0, "fora da janela de 3 dias");
  assert.equal(run([inst("1", "a", today)])[0]?.kind, "due_today");
  assert.equal(run([inst("1", "a", addDays(today, -1))]).length, 0, "1–2 dias de atraso: sem mensagem");
  assert.equal(run([inst("1", "a", addDays(today, -3))])[0]?.kind, "overdue_3");
  assert.equal(run([inst("1", "a", addDays(today, -8))])[0]?.kind, "overdue_7");
  assert.equal(run([inst("1", "a", addDays(today, -20))])[0]?.kind, "overdue_15");
});

test("não repete etapa e não volta etapas; para depois da última", () => {
  const d = addDays(today, -8);
  assert.equal(run([inst("1", "a", d)], [log("1", "overdue_7", d)]).length, 0);
  assert.equal(run([inst("1", "a", d)], [log("1", "overdue_3", d)])[0]?.kind, "overdue_7", "avança do 3 para o 7");
  const d20 = addDays(today, -20);
  assert.equal(run([inst("1", "a", d20)], [log("1", "overdue_15", d20)]).length, 0);
});

test("adiamento reinicia o ciclo (nova data de cobrança)", () => {
  const newDate = addDays(today, 2);
  const items = run([inst("1", "a", newDate, { original_due_date: addDays(today, -10) })], [log("1", "overdue_7", addDays(today, -10))]);
  assert.equal(items[0]?.kind, "before_due");
});

test("uma mensagem por cliente por dia, agrupando parcelas da mesma etapa", () => {
  const items = run([inst("1", "a", addDays(today, -4)), inst("2", "a", addDays(today, -5), { remaining: 50 }), inst("3", "a", today)]);
  assert.equal(items.length, 1);
  assert.equal(items[0].kind, "overdue_3");
  assert.equal(items[0].amount, 150);
  assert.equal(items[0].installments.length, 2);
  assert.equal(run([inst("1", "a", today)], [log("x", "overdue_3", "2026-11-01", today)]).length, 0, "já recebeu mensagem hoje");
});

test("ignora opt-out, sem telefone e parcela coberta por pagamento a confirmar", () => {
  assert.equal(run([inst("1", "a", today)], [], [cust("a", { opt_out: true })]).length, 0);
  assert.equal(run([inst("1", "a", today)], [], [cust("a", { phone: null })]).length, 0);
  assert.equal(run([inst("1", "a", today, { pending_confirmation_amount: 100 })]).length, 0);
  assert.equal(run([inst("1", "a", today, { pending_confirmation_amount: 40 })])[0].amount, 60);
});

test("promessa do dia tem prioridade; agradecimento é à parte", () => {
  const items = run([inst("1", "a", addDays(today, -9))], [], undefined, {
    promises: [{ id: "p1", customer_id: "a", amount: 80, due_date: today }],
    payments: [{ id: "pay1", customer_id: "b", amount: 120, paid_on: addDays(today, -1) }],
  });
  assert.deepEqual(items.map((i) => i.kind), ["promise", "thanks"]);
});

test("etapa desativada é respeitada", () => {
  const settings = { ...DEFAULT_MESSAGE_SETTINGS, steps: { ...DEFAULT_MESSAGE_SETTINGS.steps, due_today: { enabled: false } } };
  assert.equal(computeQueue({ today, settings, customers: [cust("a")], installments: [inst("1", "a", today)], promises: [], payments: [], logs: [] }).length, 0);
});

test("texto renderizado com variáveis, Pix e saldo", () => {
  const t = renderTemplate(DEFAULT_TEMPLATES.overdue_7, { fullName: "MARIA santos", company: "PLASCOTEL", amount: 150, dueDate: "2026-11-01", daysOverdue: 9, pixCode: "000201XYZ" }, "overdue_7");
  assert.ok(t.startsWith("Olá, Maria."));
  assert.ok(t.includes("R$ 150,00") && t.includes("01/11/2026") && t.includes("9 dias") && t.includes("000201XYZ"));
  const semPix = renderTemplate(DEFAULT_TEMPLATES.due_today, { fullName: "João", company: "PLASCOTEL", amount: 10, dueDate: today }, "due_today");
  assert.ok(!semPix.includes("Pix Copia"));
  const obrigado = renderTemplate(DEFAULT_TEMPLATES.thanks, { fullName: "Ana", company: "PLASCOTEL", amount: 50, balance: 0 }, "thanks");
  assert.ok(obrigado.includes("quitada"));
});
