import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPixPayload, crc16, normalizePixKey } from "../../src/lib/pix";

test("CRC16 bate com o exemplo oficial do Banco Central", () => {
  const ex = "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304";
  assert.equal(crc16(ex), "1D3D");
});

test("gera payload com valor, recebedor sanitizado e CRC válido", () => {
  const p = buildPixPayload({ key: "contato@plascotel.com.br", name: "Plascotél Móveis Ltda", city: "Jacobina", amount: 150.5, txid: "VENDA12P3" });
  assert.match(p, /^000201/);
  assert.ok(p.includes("0014br.gov.bcb.pix0124contato@plascotel.com.br"));
  assert.ok(p.includes("5406150.50"));
  assert.ok(p.includes("5921PLASCOTEL MOVEIS LTDA"));
  assert.ok(p.includes("6008JACOBINA"));
  assert.ok(p.includes("62130509VENDA12P3"));
  assert.equal(p.slice(-4), crc16(p.slice(0, -4)));
});

test("normaliza tipos de chave", () => {
  assert.deepEqual(normalizePixKey("(74) 99999-0000"), { key: "+5574999990000", type: "phone" });
  assert.deepEqual(normalizePixKey("529.982.247-25"), { key: "52998224725", type: "cpf" });
  assert.deepEqual(normalizePixKey("12.345.678/0001-95"), { key: "12345678000195", type: "cnpj" });
  assert.equal(normalizePixKey("chave errada")?.type, undefined);
});
