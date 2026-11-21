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

/* ── Cartão ───────────────────────────────────────── */

test('cria cartão: aparece com limite, uso zero e a fatura em curso', async () => {
  const { cartao } = await comCartao();
  assert.deepEqual([cartao.nome, cartao.limite, cartao.usado, cartao.disponivel, cartao.percentual_usado], ['Nubank', 5000, 0, 5000, 0]);
  assert.equal(cartao.fatura_atual.status, 'aberta');
  assert.equal(cartao.fatura_atual.total, 0);
});

test('cartão também aparece como conta (tipo cartao), com saldo igual à dívida negativa', async () => {
  const { u, cartao } = await comCartao({ divida_inicial: 300 });
  const conta = (await u.agente.get('/api/contas')).body.find(c => c.id === cartao.id);
  assert.equal(conta.tipo, 'cartao');
  assert.equal(conta.saldo, -300);
  assert.equal((await u.agente.get('/api/cartoes')).body[0].usado, 300);
});

test('validações do cartão', async () => {
  const u = await novoUsuario();
  const casos = [
    [{ nome: '' }, /nome/i], [{ limite: 0 }, /limite/i], [{ limite: 'x' }, /limite/i],
    [{ dia_fechamento: 0 }, /fechamento/], [{ dia_fechamento: 32 }, /fechamento/],
    [{ dia_vencimento: 'a' }, /vencimento/], [{ cor: 'roxo' }, /cor/i], [{ divida_inicial: -5 }, /dívida/],
    [{ conta_pagamento_id: 999999 }, /pagamento/],
  ];
  for (const [extra, regex] of casos) {
    const r = await u.agente.post('/api/cartoes').send(cartaoBase(extra));
    assert.equal(r.status, 400, JSON.stringify(extra));
    assert.match(r.body.error, regex, JSON.stringify(extra));
  }
  await u.agente.post('/api/cartoes').send(cartaoBase());
  assert.equal((await u.agente.post('/api/cartoes').send(cartaoBase({ nome: 'nubank' }))).status, 409);
});

test('cartão não é criado nem convertido pela rota de contas', async () => {
  const { u, cartao } = await comCartao();
  const r = await u.agente.post('/api/contas').send({ nome: 'Outro', tipo: 'cartao' });
  assert.equal(r.status, 400);
  const conv = await u.agente.put(`/api/contas/${cartao.id}`).send({ nome: 'Nubank', tipo: 'corrente' });
  assert.equal(conv.status, 400);
  const comum = (await u.agente.get('/api/contas')).body.find(c => c.tipo === 'corrente');
  assert.equal((await u.agente.put(`/api/contas/${comum.id}`).send({ nome: comum.nome, tipo: 'cartao' })).status, 400);
  const arq = await u.agente.put(`/api/contas/${cartao.id}`).send({ nome: 'Nubank', tipo: 'cartao', arquivada: true });
  assert.equal(arq.status, 200, 'arquivar o cartão pela tela de contas é permitido');
  assert.equal(arq.body.arquivada, true);
});

test('editar o cartão muda limite e dias; excluir só sem movimentações', async () => {
  const { u, cartao } = await comCartao();
  const put = await u.agente.put(`/api/cartoes/${cartao.id}`).send(cartaoBase({ limite: 8000, dia_fechamento: 20, dia_vencimento: 28 }));
  assert.equal(put.body.limite, 8000);
  assert.equal(put.body.dia_fechamento, 20);
  await compra(u, cartao);
  assert.equal((await u.agente.delete(`/api/cartoes/${cartao.id}`)).status, 409);
  const vazio = (await u.agente.post('/api/cartoes').send(cartaoBase({ nome: 'Vazio' }))).body;
  assert.equal((await u.agente.delete(`/api/cartoes/${vazio.id}`)).status, 200);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM cartoes WHERE conta_id = ?').get(vazio.id).n, 0, 'a configuração some junto');
});

/* ── Compras e faturas ────────────────────────────── */

test('a compra cai na fatura certa pela data e pelo fechamento', async () => {
  const { u, cartao } = await comCartao(); // fecha dia 10
  const r1 = await compra(u, cartao, { data: '2026-03-10' });
  const r2 = await compra(u, cartao, { data: '2026-03-11' });
  assert.equal(r1.body.fatura, '2026-03');
  assert.equal(r2.body.fatura, '2026-04');
  assert.equal((await fatura(u, cartao, '2026-03')).lancamentos.length, 1);
  assert.equal((await fatura(u, cartao, '2026-04')).lancamentos.length, 1);
});

test('lançamento em conta comum não tem fatura', async () => {
  const u = await novoUsuario();
  const r = await u.agente.post('/api/transactions').send({ desc: 'x', valor: 1, tipo: 'saida', cat: 'Outros', data: '2026-03-01' });
  assert.equal(r.body.fatura, null);
  assert.equal(r.body.parcela, null);
});

test('total da fatura soma compras e subtrai estornos', async () => {
  const { u, cartao } = await comCartao();
  await compra(u, cartao, { valor: 300 });
  await compra(u, cartao, { valor: 50.5, data: '2026-03-08' });
  await compra(u, cartao, { valor: 80, tipo: 'entrada', desc: 'Estorno', data: '2026-03-09' });
  const f = await fatura(u, cartao, '2026-03');
  assert.equal(f.total, 270.5);
  assert.equal(f.itens, 3);
  assert.equal(f.fechamento, '2026-03-10');
  assert.equal(f.vencimento, '2026-03-17');
});

test('limite usado e disponível acompanham as compras', async () => {
  const { u, cartao } = await comCartao({ limite: 1000 });
  await compra(u, cartao, { valor: 250 });
  await compra(u, cartao, { valor: 150, data: '2026-04-20' });
  const c = (await u.agente.get('/api/cartoes')).body[0];
  assert.deepEqual([c.usado, c.disponivel, c.percentual_usado], [400, 600, 40]);
});

test('compra no cartão conta como gasto na data e não mexe no saldo da conta bancária', async () => {
  const { u, cartao } = await comCartao();
  const [principal] = (await u.agente.get('/api/contas')).body.filter(c => c.tipo === 'corrente');
  await compra(u, cartao, { valor: 200, data: '2026-03-05' });
  const resumo = (await u.agente.get('/api/resumo?mes=2026-03')).body;
  assert.equal(resumo.saidas, 200);
  const contas = (await u.agente.get('/api/contas')).body;
  assert.equal(contas.find(c => c.id === principal.id).saldo, 0);
  assert.equal(contas.find(c => c.id === cartao.id).saldo, -200);
});

/* ── Parcelamento ─────────────────────────────────── */

test('compra parcelada em 3x gera 3 lançamentos que somam o total, um por fatura', async () => {
  const { u, cartao } = await comCartao();
  const r = await compra(u, cartao, { desc: 'Notebook', valor: 100, parcelas: 3, data: '2026-03-05' });
  assert.equal(r.status, 201);
  assert.equal(r.body.parcelas_criadas, 3);
  const lista = (await u.agente.get(`/api/transactions?conta_id=${cartao.id}`)).body.itens.reverse();
  assert.deepEqual(lista.map(t => t.valor), [33.34, 33.33, 33.33]);
  assert.deepEqual(lista.map(t => t.data), ['2026-03-05', '2026-04-05', '2026-05-05']);
  assert.deepEqual(lista.map(t => t.fatura), ['2026-03', '2026-04', '2026-05']);
  assert.deepEqual(lista.map(t => t.desc), ['Notebook (1/3)', 'Notebook (2/3)', 'Notebook (3/3)']);
  assert.deepEqual(lista.map(t => t.parcela), [{ numero: 1, total: 3 }, { numero: 2, total: 3 }, { numero: 3, total: 3 }]);
  assert.equal(new Set(lista.map(t => t.grupo_parcelas)).size, 1);
  assert.equal(Math.round(lista.reduce((a, t) => a + t.valor, 0) * 100), 10000);
});

test('parcelas contam como gasto em cada mês (competência pela parcela)', async () => {
  const { u, cartao } = await comCartao();
  await compra(u, cartao, { valor: 300, parcelas: 3, data: '2026-03-05' });
  for (const mes of ['2026-03', '2026-04', '2026-05']) assert.equal((await u.agente.get(`/api/resumo?mes=${mes}`)).body.saidas, 100, mes);
});

test('parcela no dia 31 respeita meses curtos', async () => {
  const { u, cartao } = await comCartao();
  await compra(u, cartao, { valor: 90, parcelas: 3, data: '2026-01-31' });
  const datas = (await u.agente.get(`/api/transactions?conta_id=${cartao.id}`)).body.itens.map(t => t.data).reverse();
  assert.deepEqual(datas, ['2026-01-31', '2026-02-28', '2026-03-31']);
});

test('parcelar só vale para saída em cartão; limites do número de parcelas', async () => {
  const { u, cartao } = await comCartao();
  const principal = (await u.agente.get('/api/contas')).body.find(c => c.tipo === 'corrente');
  assert.equal((await compra(u, principal, { parcelas: 3 })).status, 400, 'conta comum');
  assert.equal((await compra(u, cartao, { parcelas: 3, tipo: 'entrada' })).status, 400, 'entrada');
  for (const parcelas of [0, 49, 2.5, 'x']) assert.equal((await compra(u, cartao, { parcelas })).status, 400, String(parcelas));
  assert.equal((await compra(u, cartao, { parcelas: 48 })).status, 201);
  assert.equal((await u.agente.get(`/api/transactions?conta_id=${cartao.id}`)).body.total, 48, 'só as 48, nada das tentativas inválidas');
});

test('descrição longa cabe com o sufixo da parcela', async () => {
  const { u, cartao } = await comCartao();
  const r = await compra(u, cartao, { desc: 'x'.repeat(120), parcelas: 12 });
  assert.equal(r.status, 201);
  const lista = (await u.agente.get(`/api/transactions?conta_id=${cartao.id}`)).body.itens;
  assert.ok(lista.every(t => t.desc.length <= 120 && /\(\d+\/12\)$/.test(t.desc)));
});

test('não dá para parcelar um lançamento já existente (PUT)', async () => {
  const { u, cartao } = await comCartao();
  const { body } = await compra(u, cartao);
  const r = await compra(u, cartao, { parcelas: 3 }).then(() => u.agente.put(`/api/transactions/${body.id}`).send({ desc: 'x', valor: 1, tipo: 'saida', cat: 'Outros', data: '2026-03-05', conta_id: cartao.id, parcelas: 3 }));
  assert.equal(r.status, 400);
});

test('excluir parcelas: só esta, esta e as futuras, ou todas', async () => {
  const { u, cartao } = await comCartao();
  // Devolve só as parcelas da compra recém-criada (cada compra tem um nome próprio), da primeira à última.
  const criar = async nome => {
    await compra(u, cartao, { desc: nome, valor: 400, parcelas: 4 });
    return (await u.agente.get(`/api/transactions?conta_id=${cartao.id}`)).body.itens.filter(t => t.desc.startsWith(nome)).reverse();
  };
  const total = async () => (await u.agente.get(`/api/transactions?conta_id=${cartao.id}`)).body.total;

  let p = await criar('Compra A');
  assert.equal((await u.agente.delete(`/api/transactions/${p[1].id}`)).body.removidos, 1);
  assert.equal(await total(), 3);
  assert.equal((await u.agente.delete(`/api/transactions/${p[2].id}?parcelas=futuras`)).body.removidos, 2);
  assert.equal(await total(), 1, 'sobrou a primeira');
  p = await criar('Compra B');
  assert.equal((await u.agente.delete(`/api/transactions/${p[0].id}?parcelas=todas`)).body.removidos, 4);
  assert.equal(await total(), 1, 'a primeira parcela da compra A continua');
});

