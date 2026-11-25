// Datas gravadas ficam entre 01/01/2000 e hoje + 10 anos: pega erro de digitação (0026, 2205) sem barrar
// parcelas e recorrentes futuros. O prazo de uma meta vai até 50 anos (aposentadoria, por exemplo).
const test = require('node:test');
const assert = require('node:assert/strict');
const { novoUsuario, categoriaDe } = require('./helpers');
const { hojeBR } = require('../lib/datas');

const ano = Number(hojeBR().slice(0, 4));
const lancar = (u, data) => u.agente.post('/api/transactions').send({ desc: 'Pão', valor: 5, tipo: 'saida', data, cat: 'Outros' });

test('lançamento: aceita de 2000 até daqui a 10 anos e recusa o resto com mensagem', async () => {
  const u = await novoUsuario();
  assert.equal((await lancar(u, '2000-01-01')).status, 201);
  assert.equal((await lancar(u, `${ano + 10}-01-01`)).status, 201);
  for (const data of ['1999-12-31', '0001-01-01', `${ano + 11}-01-01`, '9999-12-31']) {
    const r = await lancar(u, data);
    assert.equal(r.status, 400, data);
    assert.match(r.body.error, /entre 01\/01\/2000 e/, data);
  }
});

test('meta aceita prazo longo (até 50 anos), mas não absurdo', async () => {
  const u = await novoUsuario();
  assert.equal((await u.agente.post('/api/metas').send({ nome: 'Aposentadoria', valor_alvo: 1000, prazo: `${ano + 40}-01-01` })).status, 201);
  assert.equal((await u.agente.post('/api/metas').send({ nome: 'Absurda', valor_alvo: 1000, prazo: '9999-01-01' })).status, 400);
});

test('recorrente não é lançado em mês fora da faixa; importação recusa a linha', async () => {
  const u = await novoUsuario();
  const rec = (await u.agente.post('/api/recorrentes').send({ nome: 'Netflix', valor: 50, tipo: 'fixo', dia: 10, cat: 'Outros' })).body;
  assert.equal((await u.agente.post(`/api/recorrentes/${rec.id}/lancar`).send({ mes: '1900-01' })).status, 400);
  assert.equal((await u.agente.post('/api/recorrentes/lancar-pendentes').send({ mes: '2099-12' })).status, 400);

  const conta = (await u.agente.get('/api/contas')).body[0];
  const cat = await categoriaDe(u.agente, 'Outros');
  const r = await u.agente.post('/api/importacao/confirmar').send({ conta_id: conta.id, itens: [{ desc: 'x', valor: 1, tipo: 'saida', data: '1990-05-01', categoria_id: cat.id }] });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /Linha 1: .*entre 01\/01\/2000/);
});
