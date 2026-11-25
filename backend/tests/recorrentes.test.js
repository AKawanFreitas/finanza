const test = require('node:test');
const assert = require('node:assert/strict');
const { novoUsuario } = require('./helpers');

async function comRecorrentes() {
  const u = await novoUsuario();
  const cria = async d => (await u.agente.post('/api/recorrentes').send({ tipo: 'fixo', cat: 'Moradia', ...d })).body;
  const aluguel = await cria({ nome: 'Aluguel', valor: 2000, dia: 5 });
  const luz     = await cria({ nome: 'Luz', valor: 150.75, dia: 31, tipo: 'recorrente' });
  return { u, aluguel, luz };
}

test('lista marca como lançado só no mês pedido', async () => {
  const { u, aluguel } = await comRecorrentes();
  await u.agente.post(`/api/recorrentes/${aluguel.id}/lancar`).send({ mes: '2026-03' });
  const em = async mes => (await u.agente.get(`/api/recorrentes?mes=${mes}`)).body.find(r => r.nome === 'Aluguel').lancado;
  assert.equal(await em('2026-03'), true);
  assert.equal(await em('2026-04'), false);
});

test('lançar cria o gasto na data de vencimento, com categoria e valor do recorrente', async () => {
  const { u, aluguel } = await comRecorrentes();
  const r = await u.agente.post(`/api/recorrentes/${aluguel.id}/lancar`).send({ mes: '2026-03' });
  assert.equal(r.status, 201);
  assert.equal(r.body.data, '2026-03-05');
  assert.equal(r.body.valor, 2000);
  assert.equal(r.body.tipo, 'saida');
  assert.equal(r.body.cat, 'Moradia');
  assert.equal(r.body.recorrente_id, aluguel.id);
});

test('dia 31 cai no último dia de meses curtos', async () => {
  const { u, luz } = await comRecorrentes();
  assert.equal((await u.agente.post(`/api/recorrentes/${luz.id}/lancar`).send({ mes: '2026-02' })).body.data, '2026-02-28');
  assert.equal((await u.agente.post(`/api/recorrentes/${luz.id}/lancar`).send({ mes: '2028-02' })).body.data, '2028-02-29');
});

test('lançar duas vezes no mesmo mês não duplica', async () => {
  const { u, aluguel } = await comRecorrentes();
  assert.equal((await u.agente.post(`/api/recorrentes/${aluguel.id}/lancar`).send({ mes: '2026-03' })).status, 201);
  assert.equal((await u.agente.post(`/api/recorrentes/${aluguel.id}/lancar`).send({ mes: '2026-03' })).status, 409);
  assert.equal((await u.agente.get('/api/transactions?mes=2026-03')).body.total, 1);
});

test('lançar pendentes pula os já lançados e é idempotente', async () => {
  const { u, aluguel } = await comRecorrentes();
  await u.agente.post(`/api/recorrentes/${aluguel.id}/lancar`).send({ mes: '2026-03' });
  const r1 = await u.agente.post('/api/recorrentes/lancar-pendentes').send({ mes: '2026-03' });
  assert.equal(r1.body.lancados, 1);
  assert.equal(r1.body.itens[0].desc, 'Luz');
  const r2 = await u.agente.post('/api/recorrentes/lancar-pendentes').send({ mes: '2026-03' });
  assert.equal(r2.body.lancados, 0);
  assert.equal((await u.agente.get('/api/transactions?mes=2026-03')).body.total, 2);
});

test('lança na conta escolhida; conta alheia é recusada', async () => {
  const { u, aluguel } = await comRecorrentes();
  const reserva = (await u.agente.post('/api/contas').send({ nome: 'Reserva', tipo: 'poupanca' })).body;
  const r = await u.agente.post(`/api/recorrentes/${aluguel.id}/lancar`).send({ mes: '2026-03', conta_id: reserva.id });
  assert.equal(r.body.conta, 'Reserva');

  const outro = await novoUsuario();
  const contaAlheia = (await outro.agente.get('/api/contas')).body[0];
  const ruim = await u.agente.post(`/api/recorrentes/${aluguel.id}/lancar`).send({ mes: '2026-04', conta_id: contaAlheia.id });
  assert.equal(ruim.status, 400);
});

test('não lança recorrente de outra conta de usuário', async () => {
  const { aluguel } = await comRecorrentes();
  const outro = await novoUsuario();
  assert.equal((await outro.agente.post(`/api/recorrentes/${aluguel.id}/lancar`).send({ mes: '2026-03' })).status, 404);
});

test('mês inválido dá 400', async () => {
  const { u, aluguel } = await comRecorrentes();
  assert.equal((await u.agente.post(`/api/recorrentes/${aluguel.id}/lancar`).send({ mes: 'março' })).status, 400);
  assert.equal((await u.agente.get('/api/recorrentes?mes=2026-99')).status, 400);
});

test('excluir o recorrente mantém os lançamentos que ele gerou', async () => {
  const { u, aluguel } = await comRecorrentes();
  await u.agente.post(`/api/recorrentes/${aluguel.id}/lancar`).send({ mes: '2026-03' });
  await u.agente.delete(`/api/recorrentes/${aluguel.id}`);
  const r = (await u.agente.get('/api/transactions')).body;
  assert.equal(r.total, 1);
  assert.equal(r.itens[0].recorrente_id, null);
});

test('recorrente de entrada (salário): lança como receita; sem informar, continua saída', async () => {
  const u = await novoUsuario();
  const salario = (await u.agente.post('/api/recorrentes').send({ nome: 'Salário', valor: 3000, tipo: 'fixo', movimento: 'entrada', dia: 5, cat: 'Renda' })).body;
  assert.equal(salario.movimento, 'entrada');
  const aluguel = (await u.agente.post('/api/recorrentes').send({ nome: 'Aluguel', valor: 1500, tipo: 'fixo', dia: 10, cat: 'Moradia' })).body;
  assert.equal(aluguel.movimento, 'saida', 'quem não informa continua como gasto');

  const lancado = (await u.agente.post(`/api/recorrentes/${salario.id}/lancar`).send({ mes: '2026-03' })).body;
  assert.equal(lancado.tipo, 'entrada');
  assert.equal((await u.agente.post(`/api/recorrentes/${aluguel.id}/lancar`).send({ mes: '2026-03' })).body.tipo, 'saida');

  const editado = (await u.agente.put(`/api/recorrentes/${aluguel.id}`).send({ nome: 'Aluguel recebido', valor: 1500, tipo: 'fixo', movimento: 'entrada', dia: 10, cat: 'Renda' })).body;
  assert.equal(editado.movimento, 'entrada');
  assert.equal((await u.agente.post('/api/recorrentes').send({ nome: 'X', valor: 1, tipo: 'fixo', movimento: 'talvez', dia: 1, cat: 'Renda' })).status, 400);
});

test('recorrente automático de entrada é lançado como receita pelo agendador', async () => {
  const { executarAutomaticos } = require('../lib/recorrentes');
  const { db } = require('./helpers');
  const u = await novoUsuario();
  const rec = (await u.agente.post('/api/recorrentes').send({ nome: 'Aluguel recebido', valor: 900, tipo: 'fixo', movimento: 'entrada', dia: 1, cat: 'Renda', automatico: true })).body;
  executarAutomaticos(new Date());
  assert.equal(db.prepare('SELECT tipo FROM transactions WHERE recorrente_id = ?').get(rec.id).tipo, 'entrada');
});
