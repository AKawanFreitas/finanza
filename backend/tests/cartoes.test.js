const test = require('node:test');
const assert = require('node:assert/strict');
const { db, novoUsuario } = require('./helpers');
const { mesDaFatura, datasDaFatura, statusDaFatura } = require('../lib/cartoes');
const { dividirParcelas, dataDaParcela } = require('../lib/parcelas');

const cartaoBase = (extra = {}) => ({ nome: 'Nubank', limite: 5000, dia_fechamento: 10, dia_vencimento: 17, ...extra });

async function comCartao(extra) {
  const u = await novoUsuario();
  const r = await u.agente.post('/api/cartoes').send(cartaoBase(extra));
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return { u, cartao: r.body };
}
const compra = (u, cartao, extra = {}) => u.agente.post('/api/transactions').send({
  desc: 'Compra', valor: 100, tipo: 'saida', cat: 'Outros', data: '2026-03-05', conta_id: cartao.id, ...extra,
});
const fatura = async (u, cartao, mes) => (await u.agente.get(`/api/cartoes/${cartao.id}/faturas/${mes}`)).body;

/* ── Regras puras ─────────────────────────────────── */

test('mês da fatura: até o dia do fechamento é o mesmo mês; depois, o seguinte', () => {
  assert.equal(mesDaFatura('2026-03-09', 10), '2026-03');
  assert.equal(mesDaFatura('2026-03-10', 10), '2026-03', 'no dia do fechamento ainda entra');
  assert.equal(mesDaFatura('2026-03-11', 10), '2026-04');
  assert.equal(mesDaFatura('2026-12-20', 10), '2027-01', 'vira o ano');
  assert.equal(mesDaFatura('2026-02-28', 31), '2026-02', 'fechamento dia 31 vale o mês todo');
});

test('datas: vencimento depois do fechamento é no mesmo mês; antes, no mês seguinte', () => {
  assert.deepEqual(datasDaFatura('2026-03', { dia_fechamento: 5, dia_vencimento: 15 }), { fechamento: '2026-03-05', vencimento: '2026-03-15' });
  assert.deepEqual(datasDaFatura('2026-03', { dia_fechamento: 25, dia_vencimento: 5 }), { fechamento: '2026-03-25', vencimento: '2026-04-05' });
  assert.deepEqual(datasDaFatura('2026-02', { dia_fechamento: 31, dia_vencimento: 31 }), { fechamento: '2026-02-28', vencimento: '2026-03-31' });
});

test('status da fatura', () => {
  const d = { fechamento: '2026-03-10', vencimento: '2026-03-17' };
  assert.equal(statusDaFatura(100, 0, d, '2026-03-10'), 'aberta');
  assert.equal(statusDaFatura(100, 0, d, '2026-03-11'), 'fechada');
  assert.equal(statusDaFatura(100, 0, d, '2026-03-17'), 'fechada');
  assert.equal(statusDaFatura(100, 0, d, '2026-03-18'), 'vencida');
  assert.equal(statusDaFatura(100, 40, d, '2026-03-20'), 'parcial');
  assert.equal(statusDaFatura(100, 100, d, '2026-03-20'), 'paga');
  assert.equal(statusDaFatura(0, 0, d, '2026-03-20'), 'fechada', 'sem compras não vence');
});

test('parcelas somam exatamente o total, com os centavos extras nas primeiras', () => {
  assert.deepEqual(dividirParcelas(10000, 3), [3334, 3333, 3333]);
  assert.deepEqual(dividirParcelas(10000, 4), [2500, 2500, 2500, 2500]);
  assert.deepEqual(dividirParcelas(1, 3), [1, 0, 0].map(x => x));
  for (const [total, n] of [[99999, 7], [1234567, 48], [5, 2]]) assert.equal(dividirParcelas(total, n).reduce((a, b) => a + b, 0), total);
});

test('data da parcela: mesmo dia nos meses seguintes, limitado ao fim do mês', () => {
  assert.equal(dataDaParcela('2026-01-31', 0), '2026-01-31');
  assert.equal(dataDaParcela('2026-01-31', 1), '2026-02-28');
  assert.equal(dataDaParcela('2026-01-31', 2), '2026-03-31');
  assert.equal(dataDaParcela('2028-01-31', 1), '2028-02-29');
  assert.equal(dataDaParcela('2026-11-15', 3), '2027-02-15');
});

