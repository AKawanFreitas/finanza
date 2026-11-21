const test = require('node:test');
const { beforeEach } = test;
const assert = require('node:assert/strict');
const { db, novoUsuario } = require('./helpers');
const { executarAutomaticos } = require('../lib/recorrentes');
const { rodarTarefas } = require('../lib/agendador');

// O agendador olha todos os usuários do banco: cada teste começa sem nenhum recorrente automático alheio.
beforeEach(() => { db.prepare('UPDATE recorrentes SET automatico = 0').run(); });

// Instante em UTC. 12h UTC = 9h em Brasília, então cai no mesmo dia.
const em = (iso) => new Date(`${iso}T12:00:00Z`);

async function cenario(extra = {}) {
  const u = await novoUsuario();
  const cria = async d => (await u.agente.post('/api/recorrentes').send({ tipo: 'fixo', cat: 'Moradia', valor: 100, ...d })).body;
  const aluguel = await cria({ nome: 'Aluguel', dia: 5, automatico: true, ...extra });
  const manual  = await cria({ nome: 'Manual', dia: 5 });
  return { u, aluguel, manual };
}

const lancamentos = async (u, mes) => (await u.agente.get(`/api/transactions?mes=${mes}`)).body.itens;

test('só lança os marcados como automáticos', async () => {
  const { u } = await cenario();
  assert.equal(executarAutomaticos(em('2026-03-10')), 1);
  assert.deepEqual((await lancamentos(u, '2026-03')).map(t => t.desc), ['Aluguel']);
});

test('não lança antes do vencimento e lança a partir do dia', async () => {
  const { u } = await cenario();
  assert.equal(executarAutomaticos(em('2026-03-04')), 0);
  assert.equal(executarAutomaticos(em('2026-03-05')), 1);
  assert.equal((await lancamentos(u, '2026-03'))[0].data, '2026-03-05');
});

test('recuperação: se o servidor ficou fora, lança depois com a data do vencimento', async () => {
  const { u } = await cenario();
  executarAutomaticos(em('2026-03-20'));
  assert.equal((await lancamentos(u, '2026-03'))[0].data, '2026-03-05');
});

test('é idempotente: rodar várias vezes não duplica', async () => {
  const { u } = await cenario();
  executarAutomaticos(em('2026-03-10'));
  assert.equal(executarAutomaticos(em('2026-03-10')), 0);
  assert.equal(executarAutomaticos(em('2026-03-11')), 0);
  assert.equal((await lancamentos(u, '2026-03')).length, 1);
});

test('lançar manualmente antes impede o automático de duplicar', async () => {
  const { u, aluguel } = await cenario();
  await u.agente.post(`/api/recorrentes/${aluguel.id}/lancar`).send({ mes: '2026-03' });
  assert.equal(executarAutomaticos(em('2026-03-10')), 0);
  assert.equal((await lancamentos(u, '2026-03')).length, 1);
});

test('meses diferentes lançam separadamente', async () => {
  const { u } = await cenario();
  executarAutomaticos(em('2026-03-10'));
  executarAutomaticos(em('2026-04-10'));
  assert.equal((await lancamentos(u, '2026-03')).length + (await lancamentos(u, '2026-04')).length, 2);
});

test('dia 31 em mês curto vence no último dia', async () => {
  const u = await novoUsuario();
  await u.agente.post('/api/recorrentes').send({ nome: 'Luz', valor: 50, tipo: 'fixo', cat: 'Moradia', dia: 31, automatico: true });
  assert.equal(executarAutomaticos(em('2026-02-27')), 0);
  assert.equal(executarAutomaticos(em('2026-02-28')), 1);
});

test('usa o fuso do Brasil: 01h UTC do dia 6 ainda é dia 5 em Brasília', async () => {
  const { u } = await cenario({ dia: 6 });
  assert.equal(executarAutomaticos(new Date('2026-03-06T01:00:00Z')), 0);
  assert.equal(executarAutomaticos(new Date('2026-03-06T03:30:00Z')), 1);
  assert.equal((await lancamentos(u, '2026-03')).length, 1);
});

test('lança na conta escolhida; se ela foi arquivada, cai na principal', async () => {
  const u = await novoUsuario();
  const reserva = (await u.agente.post('/api/contas').send({ nome: 'Reserva', tipo: 'poupanca' })).body;
  const rec = (await u.agente.post('/api/recorrentes').send({ nome: 'Aporte', valor: 100, tipo: 'fixo', cat: 'Outros', dia: 1, automatico: true, conta_id: reserva.id })).body;
  assert.equal(rec.conta_id, reserva.id);
  executarAutomaticos(em('2026-03-10'));
  assert.equal((await lancamentos(u, '2026-03'))[0].conta, 'Reserva');

  await u.agente.put(`/api/contas/${reserva.id}`).send({ nome: 'Reserva', tipo: 'poupanca', arquivada: true });
  executarAutomaticos(em('2026-04-10'));
  assert.equal((await lancamentos(u, '2026-04'))[0].conta, 'Conta principal');
});

test('conta de outro usuário não vale no recorrente', async () => {
  const a = await novoUsuario('Ana');
  const b = await novoUsuario('Bia');
  const contaA = (await a.agente.get('/api/contas')).body[0];
  const r = await b.agente.post('/api/recorrentes').send({ nome: 'x', valor: 1, tipo: 'fixo', cat: 'Outros', dia: 1, automatico: true, conta_id: contaA.id });
  assert.equal(r.status, 400);
});

test('usuário suspenso não recebe lançamentos automáticos', async () => {
  const { u } = await cenario();
  db.prepare("UPDATE users SET status = 'suspenso' WHERE id = ?").run(u.id);
  assert.equal(executarAutomaticos(em('2026-03-10')), 0);
});

test('o agendador roda as tarefas sem quebrar e devolve o que fez', async () => {
  await cenario();
  const r = rodarTarefas(em('2026-05-10'));
  assert.equal(typeof r.lancados, 'number');
  assert.ok(r.lancados >= 1);
});

test('automatico entra e sai pela API; valor inválido dá 400', async () => {
  const { u, aluguel } = await cenario();
  assert.equal(aluguel.automatico, true);
  const put = await u.agente.put(`/api/recorrentes/${aluguel.id}`).send({ nome: 'Aluguel', valor: 100, tipo: 'fixo', cat: 'Moradia', dia: 5, automatico: false });
  assert.equal(put.body.automatico, false);
  const ruim = await u.agente.post('/api/recorrentes').send({ nome: 'x', valor: 1, tipo: 'fixo', cat: 'Moradia', dia: 5, automatico: 'sim' });
  assert.equal(ruim.status, 400);
});
