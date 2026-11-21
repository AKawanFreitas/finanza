const test = require('node:test');
const assert = require('node:assert/strict');
const { db, novoUsuario, categoriaDe } = require('./helpers');

const nova = (extra = {}) => ({ nome: 'Nubank', tipo: 'corrente', saldo_inicial: 100, ...extra });

async function lancar(u, extra = {}) {
  const cat = await categoriaDe(u.agente, 'Outros');
  return u.agente.post('/api/transactions').send({ desc: 'x', valor: 10, tipo: 'saida', categoria_id: cat.id, data: '2026-03-10', ...extra });
}

test('toda conta nova já tem a "Conta principal"', async () => {
  const u = await novoUsuario();
  const { body } = await u.agente.get('/api/contas');
  assert.equal(body.length, 1);
  assert.equal(body[0].nome, 'Conta principal');
  assert.equal(body[0].saldo, 0);
});

test('lançamento sem conta cai na principal e aparece com o nome da conta', async () => {
  const u = await novoUsuario();
  const principal = (await u.agente.get('/api/contas')).body[0];
  const r = await lancar(u);
  assert.equal(r.status, 201);
  assert.equal(r.body.conta_id, principal.id);
  assert.equal(r.body.conta, 'Conta principal');
});

test('saldo = inicial + entradas - saídas + transferências recebidas - enviadas', async () => {
  const u = await novoUsuario();
  const a = (await u.agente.post('/api/contas').send(nova({ nome: 'A', saldo_inicial: 1000 }))).body;
  const b = (await u.agente.post('/api/contas').send(nova({ nome: 'B', saldo_inicial: 50.5 }))).body;
  await lancar(u, { conta_id: a.id, valor: 200, tipo: 'saida' });
  await lancar(u, { conta_id: a.id, valor: 30.25, tipo: 'entrada' });
  await u.agente.post('/api/transferencias').send({ origem_id: a.id, destino_id: b.id, valor: 100, data: '2026-03-11' });

  const contas = (await u.agente.get('/api/contas')).body;
  const saldo = nome => contas.find(c => c.nome === nome).saldo;
  assert.equal(saldo('A'), 730.25); // 1000 - 200 + 30.25 - 100
  assert.equal(saldo('B'), 150.5);  // 50.5 + 100
});

test('saldo inicial pode ser negativo', async () => {
  const u = await novoUsuario();
  const r = await u.agente.post('/api/contas').send(nova({ nome: 'Cheque especial', saldo_inicial: -250.4 }));
  assert.equal(r.status, 201);
  assert.equal(r.body.saldo, -250.4);
});

test('validações de conta', async () => {
  const u = await novoUsuario();
  for (const extra of [{ nome: '' }, { tipo: 'cartao' }, { cor: 'azul' }, { saldo_inicial: 'abc' }]) {
    assert.equal((await u.agente.post('/api/contas').send(nova(extra))).status, 400, JSON.stringify(extra));
  }
  await u.agente.post('/api/contas').send(nova());
  assert.equal((await u.agente.post('/api/contas').send(nova({ nome: 'nubank' }))).status, 409);
});

test('transferência não conta como receita nem gasto', async () => {
  const u = await novoUsuario();
  const [principal] = (await u.agente.get('/api/contas')).body;
  const b = (await u.agente.post('/api/contas').send(nova({ nome: 'Reserva' }))).body;
  await u.agente.post('/api/transferencias').send({ origem_id: principal.id, destino_id: b.id, valor: 500, data: '2026-03-05' });
  const r = (await u.agente.get('/api/resumo?mes=2026-03')).body;
  assert.equal(r.entradas, 0);
  assert.equal(r.saidas, 0);
  assert.equal((await u.agente.get('/api/transactions')).body.total, 0);
});

test('validações de transferência', async () => {
  const u = await novoUsuario();
  const [principal] = (await u.agente.get('/api/contas')).body;
  const b = (await u.agente.post('/api/contas').send(nova({ nome: 'Reserva' }))).body;
  const base = { origem_id: principal.id, destino_id: b.id, valor: 10, data: '2026-03-05' };
  const casos = [
    [{ destino_id: principal.id }, /diferentes/],
    [{ valor: 0 }, /maior que zero/],
    [{ data: '2026-13-01' }, /AAAA-MM-DD|inexistente/],
    [{ destino_id: 999999 }, /destino/],
  ];
  for (const [extra, regex] of casos) {
    const r = await u.agente.post('/api/transferencias').send({ ...base, ...extra });
    assert.equal(r.status, 400, JSON.stringify(extra));
    assert.match(r.body.error, regex);
  }
});

test('conta arquivada não recebe lançamento; a última ativa não pode ser arquivada', async () => {
  const u = await novoUsuario();
  const [principal] = (await u.agente.get('/api/contas')).body;
  const extra = (await u.agente.post('/api/contas').send(nova({ nome: 'Extra' }))).body;

  const arq = await u.agente.put(`/api/contas/${extra.id}`).send({ ...nova({ nome: 'Extra' }), arquivada: true });
  assert.equal(arq.body.arquivada, true);
  assert.equal((await lancar(u, { conta_id: extra.id })).status, 400);

  const ultima = await u.agente.put(`/api/contas/${principal.id}`).send({ ...nova({ nome: principal.nome }), arquivada: true });
  assert.equal(ultima.status, 409);
});

test('conta com movimentações não é excluída; vazia, sim', async () => {
  const u = await novoUsuario();
  const usada = (await u.agente.post('/api/contas').send(nova({ nome: 'Usada' }))).body;
  const vazia = (await u.agente.post('/api/contas').send(nova({ nome: 'Vazia' }))).body;
  await lancar(u, { conta_id: usada.id });
  assert.equal((await u.agente.delete(`/api/contas/${usada.id}`)).status, 409);
  assert.equal((await u.agente.delete(`/api/contas/${vazia.id}`)).status, 200);
});

test('isolamento: B não vê, usa, edita nem transfere com contas de A', async () => {
  const a = await novoUsuario('Ana');
  const b = await novoUsuario('Bia');
  const contaA = (await a.agente.post('/api/contas').send(nova({ nome: 'Da Ana' }))).body;
  const [contaB] = (await b.agente.get('/api/contas')).body;

  assert.ok(!(await b.agente.get('/api/contas')).body.some(c => c.id === contaA.id));
  assert.equal((await lancar(b, { conta_id: contaA.id })).status, 400);
  assert.equal((await b.agente.put(`/api/contas/${contaA.id}`).send(nova({ nome: 'Roubada' }))).status, 404);
  assert.equal((await b.agente.delete(`/api/contas/${contaA.id}`)).status, 404);
  const t = await b.agente.post('/api/transferencias').send({ origem_id: contaB.id, destino_id: contaA.id, valor: 1, data: '2026-03-01' });
  assert.equal(t.status, 400);
});

test('excluir usuário com dados em todas as tabelas não esbarra nas FKs', async () => {
  const u = await novoUsuario();
  const [principal] = (await u.agente.get('/api/contas')).body;
  const b = (await u.agente.post('/api/contas').send(nova({ nome: 'Reserva' }))).body;
  await lancar(u);
  await u.agente.post('/api/recorrentes').send({ nome: 'Aluguel', valor: 10, tipo: 'fixo', cat: 'Moradia', dia: 5 });
  await u.agente.post('/api/transferencias').send({ origem_id: principal.id, destino_id: b.id, valor: 1, data: '2026-03-01' });

  const r = await u.agente.delete('/api/auth/conta').send({ senha: u.senha });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  for (const t of ['transactions', 'recorrentes', 'categorias', 'contas', 'transferencias']) {
    assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE user_id = ?`).get(u.id).n, 0, t);
  }
});
