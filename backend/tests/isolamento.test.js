// O ponto mais crítico de um SaaS multiusuário: ninguém enxerga nem altera dados de outra conta.
const test = require('node:test');
const assert = require('node:assert/strict');
const { novoUsuario, categoriaDe } = require('./helpers');

async function cenario() {
  const a = await novoUsuario('Ana');
  const b = await novoUsuario('Bia');
  const catA = await categoriaDe(a.agente, 'Lazer');
  const tx  = (await a.agente.post('/api/transactions').send({ desc: 'Segredo de A', valor: 10, tipo: 'saida', categoria_id: catA.id, data: '2026-03-01' })).body;
  const rec = (await a.agente.post('/api/recorrentes').send({ nome: 'Rec de A', valor: 10, tipo: 'fixo', categoria_id: catA.id, dia: 1 })).body;
  return { a, b, catA, tx, rec };
}

test('listagens de B não trazem nada de A', async () => {
  const { b } = await cenario();
  assert.deepEqual((await b.agente.get('/api/transactions')).body.itens, []);
  assert.deepEqual((await b.agente.get('/api/recorrentes')).body, []);
  const catsB = (await b.agente.get('/api/categorias')).body;
  assert.equal(catsB.length, 8);
});

test('B não consegue editar nem apagar lançamento de A', async () => {
  const { a, b, tx } = await cenario();
  const catB = await categoriaDe(b.agente, 'Lazer');
  const dados = { desc: 'Invadido', valor: 1, tipo: 'saida', categoria_id: catB.id, data: '2026-03-01' };
  assert.equal((await b.agente.put(`/api/transactions/${tx.id}`).send(dados)).status, 404);
  await b.agente.delete(`/api/transactions/${tx.id}`);
  const doA = (await a.agente.get('/api/transactions')).body.itens;
  assert.equal(doA.length, 1);
  assert.equal(doA[0].desc, 'Segredo de A');
});

test('B não consegue editar nem apagar recorrente de A', async () => {
  const { a, b, rec } = await cenario();
  const catB = await categoriaDe(b.agente, 'Lazer');
  const dados = { nome: 'Invadido', valor: 1, tipo: 'fixo', categoria_id: catB.id, dia: 2 };
  assert.equal((await b.agente.put(`/api/recorrentes/${rec.id}`).send(dados)).status, 404);
  await b.agente.delete(`/api/recorrentes/${rec.id}`);
  assert.equal((await a.agente.get('/api/recorrentes')).body[0].nome, 'Rec de A');
});

test('B não consegue editar nem apagar categoria de A', async () => {
  const { a, b, catA } = await cenario();
  assert.equal((await b.agente.put(`/api/categorias/${catA.id}`).send({ nome: 'Roubada', cor: '#000000' })).status, 404);
  assert.equal((await b.agente.delete(`/api/categorias/${catA.id}`)).status, 404);
  assert.equal((await categoriaDe(a.agente, 'Lazer')).id, catA.id);
});

test('B não pode usar a categoria de A em um lançamento', async () => {
  const { b, catA } = await cenario();
  const r = await b.agente.post('/api/transactions').send({ desc: 'x', valor: 1, tipo: 'saida', categoria_id: catA.id, data: '2026-03-01' });
  assert.equal(r.status, 400);
  const r2 = await b.agente.post('/api/recorrentes').send({ nome: 'x', valor: 1, tipo: 'fixo', categoria_id: catA.id, dia: 1 });
  assert.equal(r2.status, 400);
});

test('B não pode mover um lançamento seu para a categoria de A', async () => {
  const { b, catA } = await cenario();
  const catB = await categoriaDe(b.agente, 'Lazer');
  const meu = (await b.agente.post('/api/transactions').send({ desc: 'meu', valor: 1, tipo: 'saida', categoria_id: catB.id, data: '2026-03-01' })).body;
  const r = await b.agente.put(`/api/transactions/${meu.id}`).send({ desc: 'meu', valor: 1, tipo: 'saida', categoria_id: catA.id, data: '2026-03-01' });
  assert.equal(r.status, 400);
});

test('categorias com o mesmo nome em contas diferentes convivem', async () => {
  const a = await novoUsuario();
  const b = await novoUsuario();
  const [ca, cb] = await Promise.all([categoriaDe(a.agente, 'Moradia'), categoriaDe(b.agente, 'Moradia')]);
  assert.notEqual(ca.id, cb.id);
});
