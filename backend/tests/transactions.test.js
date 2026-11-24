const test = require('node:test');
const assert = require('node:assert/strict');
const { db, novoUsuario, categoriaDe } = require('./helpers');

const base = (extra = {}) => ({ desc: 'Mercado', valor: 50, tipo: 'saida', cat: 'Alimentação', data: '2026-03-10', ...extra });

test('cria lançamento e devolve valor em reais, nome e id da categoria', async () => {
  const u = await novoUsuario();
  const r = await u.agente.post('/api/transactions').send(base({ valor: 19.99 }));
  assert.equal(r.status, 201);
  assert.equal(r.body.valor, 19.99);
  assert.equal(r.body.cat, 'Alimentação');
  assert.equal(r.body.categoria_id, (await categoriaDe(u.agente, 'Alimentação')).id);
});

test('guarda centavos inteiros, sem erro de ponto flutuante', async () => {
  const u = await novoUsuario();
  await u.agente.post('/api/transactions').send(base({ valor: 0.1 }));
  await u.agente.post('/api/transactions').send(base({ valor: 0.2 }));
  const { soma } = db.prepare('SELECT SUM(valor_centavos) AS soma FROM transactions WHERE user_id = ?').get(u.id);
  assert.equal(soma, 30);
  assert.equal(typeof db.prepare('SELECT valor_centavos FROM transactions WHERE user_id = ?').get(u.id).valor_centavos, 'number');
});

test('aceita categoria_id no lugar do nome', async () => {
  const u = await novoUsuario();
  const cat = await categoriaDe(u.agente, 'Lazer');
  const r = await u.agente.post('/api/transactions').send(base({ cat: undefined, categoria_id: cat.id }));
  assert.equal(r.status, 201);
  assert.equal(r.body.cat, 'Lazer');
});

test('validações', async () => {
  const u = await novoUsuario();
  const casos = [
    [{ desc: '  ' },            /descrição/i],
    [{ valor: 0 },              /maior que zero/],
    [{ valor: -5 },             /maior que zero/],
    [{ valor: 'abc' },          /maior que zero/],
    [{ tipo: 'outro' },         /entrada.*saida/],
    [{ data: '10/03/2026' },    /AAAA-MM-DD/],
    [{ data: '2026-02-31' },    /inexistente/i],
    [{ cat: 'Não existe' },     /Categoria não encontrada/],
    [{ cat: undefined },        /categoria/i],
  ];
  for (const [extra, regex] of casos) {
    const r = await u.agente.post('/api/transactions').send(base(extra));
    assert.equal(r.status, 400, JSON.stringify(extra));
    assert.match(r.body.error, regex, JSON.stringify(extra));
  }
});

test('edita e exclui', async () => {
  const u = await novoUsuario();
  const { body } = await u.agente.post('/api/transactions').send(base());
  const put = await u.agente.put(`/api/transactions/${body.id}`).send(base({ desc: 'Novo', valor: 12.5, cat: 'Lazer' }));
  assert.equal(put.status, 200);
  assert.equal(put.body.desc, 'Novo');
  assert.equal(put.body.valor, 12.5);
  assert.equal(put.body.cat, 'Lazer');
  await u.agente.delete(`/api/transactions/${body.id}`);
  assert.equal((await u.agente.get('/api/transactions')).body.itens.length, 0);
});

test('editar lançamento inexistente dá 404', async () => {
  const u = await novoUsuario();
  assert.equal((await u.agente.put('/api/transactions/999999').send(base())).status, 404);
});

test('renomear categoria reflete nos lançamentos sem UPDATE em cascata', async () => {
  const u = await novoUsuario();
  await u.agente.post('/api/transactions').send(base());
  const cat = await categoriaDe(u.agente, 'Alimentação');
  await u.agente.put(`/api/categorias/${cat.id}`).send({ nome: 'Comida', cor: cat.cor });
  const lista = (await u.agente.get('/api/transactions')).body.itens;
  assert.equal(lista[0].cat, 'Comida');
  assert.equal(lista[0].categoria_id, cat.id);
});

test('categoria em uso não pode ser excluída; sem uso, pode', async () => {
  const u = await novoUsuario();
  await u.agente.post('/api/transactions').send(base());
  const emUso = await categoriaDe(u.agente, 'Alimentação');
  const r = await u.agente.delete(`/api/categorias/${emUso.id}`);
  assert.equal(r.status, 409);
  const livre = await categoriaDe(u.agente, 'Educação');
  assert.equal((await u.agente.delete(`/api/categorias/${livre.id}`)).status, 200);
});

test('nome de categoria repetido é recusado, ignorando maiúsculas', async () => {
  const u = await novoUsuario();
  const r = await u.agente.post('/api/categorias').send({ nome: 'lazer', cor: '#123456' });
  assert.equal(r.status, 409);
});

test('recorrentes: CRUD com centavos e categoria', async () => {
  const u = await novoUsuario();
  const dados = { nome: 'Aluguel', valor: 2200.5, tipo: 'fixo', cat: 'Moradia', dia: 5 };
  const c = await u.agente.post('/api/recorrentes').send(dados);
  assert.equal(c.status, 201);
  assert.equal(c.body.valor, 2200.5);
  assert.equal(c.body.cat, 'Moradia');
  assert.equal((await u.agente.post('/api/recorrentes').send({ ...dados, dia: 32 })).status, 400);
  assert.equal((await u.agente.post('/api/recorrentes').send({ ...dados, tipo: 'x' })).status, 400);
  const put = await u.agente.put(`/api/recorrentes/${c.body.id}`).send({ ...dados, valor: 100 });
  assert.equal(put.body.valor, 100);
  await u.agente.delete(`/api/recorrentes/${c.body.id}`);
  assert.equal((await u.agente.get('/api/recorrentes')).body.length, 0);
});

test('JSON malformado devolve 400 em JSON', async () => {
  const u = await novoUsuario();
  const r = await u.agente.post('/api/transactions').set('Content-Type', 'application/json').send('{ruim');
  assert.equal(r.status, 400);
  assert.match(r.body.error, /JSON/);
});

test('rota inexistente devolve 404 em JSON', async () => {
  const u = await novoUsuario();
  const r = await u.agente.get('/api/nada');
  assert.equal(r.status, 404);
  assert.ok(r.body.error);
});

test('categoria guarda o ícone escolhido e o mantém ao editar sem informar o ícone', async () => {
  const u = await novoUsuario();
  const criada = (await u.agente.post('/api/categorias').send({ nome: 'Pets', cor: '#123456', icone: 'paw-print' })).body;
  assert.equal(criada.icone, 'paw-print');
  const editada = (await u.agente.put(`/api/categorias/${criada.id}`).send({ nome: 'Bichos', cor: '#123456' })).body;
  assert.equal(editada.icone, 'paw-print', 'sem ícone no corpo, o atual é mantido');
  const trocada = (await u.agente.put(`/api/categorias/${criada.id}`).send({ nome: 'Bichos', cor: '#123456', icone: 'heart-pulse' })).body;
  assert.equal(trocada.icone, 'heart-pulse');
  assert.equal((await u.agente.get('/api/categorias')).body.find(c => c.id === criada.id).icone, 'heart-pulse');
});

test('categoria rejeita ícone fora da lista e usa o genérico quando não vem ícone', async () => {
  const u = await novoUsuario();
  assert.equal((await u.agente.post('/api/categorias').send({ nome: 'X1', cor: '#123456', icone: 'nao-existe' })).status, 400);
  assert.equal((await u.agente.post('/api/categorias').send({ nome: 'X2', cor: '#123456' })).body.icone, 'tag');
});

test('categorias padrão já vêm com ícone', async () => {
  const u = await novoUsuario();
  const cats = (await u.agente.get('/api/categorias')).body;
  assert.equal(cats.find(c => c.nome === 'Alimentação').icone, 'utensils');
  assert.equal(cats.find(c => c.nome === 'Outros').icone, 'tag');
});
