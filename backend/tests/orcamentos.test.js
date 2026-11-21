const test = require('node:test');
const assert = require('node:assert/strict');
const { novoUsuario, categoriaDe, confirmarEmail, emailsPara, db } = require('./helpers');
const { hojeBR, mesAtual } = require('../lib/datas');

const HOJE = hojeBR();
const MES = mesAtual();
const gasta = (u, valor, extra = {}) => u.agente.post('/api/transactions').send({ desc: 'g', valor, tipo: 'saida', cat: 'Lazer', data: HOJE, ...extra });

async function comOrcamento(limite = 100, { verificado = true } = {}) {
  const u = await novoUsuario();
  if (verificado) confirmarEmail(u.id);
  const lazer = await categoriaDe(u.agente, 'Lazer');
  const r = await u.agente.put(`/api/orcamentos/${lazer.id}`).send({ limite });
  assert.equal(r.status, 200);
  return { u, lazer };
}

const orcamento = async (u, mes = MES) => (await u.agente.get(`/api/orcamentos?mes=${mes}`)).body;

test('cria, lê, altera e remove o limite de uma categoria', async () => {
  const { u, lazer } = await comOrcamento(200);
  let o = await orcamento(u);
  assert.equal(o.itens.length, 1);
  assert.deepEqual([o.itens[0].cat, o.itens[0].limite, o.itens[0].gasto, o.itens[0].restante, o.itens[0].status], ['Lazer', 200, 0, 200, 'ok']);

  const alt = await u.agente.put(`/api/orcamentos/${lazer.id}`).send({ limite: 350.5 });
  assert.equal(alt.body.limite, 350.5);
  assert.equal((await orcamento(u)).itens.length, 1, 'alterar não cria um segundo');

  assert.equal((await u.agente.delete(`/api/orcamentos/${lazer.id}`)).status, 200);
  assert.equal((await orcamento(u)).itens.length, 0);
  assert.equal((await u.agente.delete(`/api/orcamentos/${lazer.id}`)).status, 404);
});

test('conta só gastos da categoria no mês pedido', async () => {
  const { u } = await comOrcamento(100);
  await gasta(u, 30);
  await gasta(u, 20, { cat: 'Moradia' });                       // outra categoria
  await gasta(u, 500, { data: '2020-01-10' });                  // outro mês
  await gasta(u, 40, { tipo: 'entrada', cat: 'Lazer' });        // entrada não conta
  const item = (await orcamento(u)).itens[0];
  assert.equal(item.gasto, 30);
  assert.equal(item.restante, 70);
  assert.equal(item.percentual, 30);
});

test('status: ok abaixo de 80%, atenção de 80%, estourado a partir de 100%', async () => {
  const { u } = await comOrcamento(100);
  const status = async () => (await orcamento(u)).itens[0].status;
  await gasta(u, 79.99); assert.equal(await status(), 'ok');
  await gasta(u, 0.01);  assert.equal(await status(), 'atencao');
  await gasta(u, 19.99); assert.equal(await status(), 'atencao');
  await gasta(u, 0.01);  assert.equal(await status(), 'estourado');
  await gasta(u, 50);
  const i = (await orcamento(u)).itens[0];
  assert.equal(i.restante, -50);
  assert.equal(i.percentual, 150);
});

test('totais e ordenação pelo mais comprometido', async () => {
  const u = await novoUsuario();
  const [lazer, moradia] = await Promise.all([categoriaDe(u.agente, 'Lazer'), categoriaDe(u.agente, 'Moradia')]);
  await u.agente.put(`/api/orcamentos/${lazer.id}`).send({ limite: 100 });
  await u.agente.put(`/api/orcamentos/${moradia.id}`).send({ limite: 1000 });
  await gasta(u, 10);
  await gasta(u, 500, { cat: 'Moradia' });
  const o = await orcamento(u);
  assert.deepEqual(o.itens.map(i => i.cat), ['Moradia', 'Lazer']);
  assert.deepEqual(o.totais, { limite: 1100, gasto: 510 });
});

test('o resumo do dashboard já traz os orçamentos', async () => {
  const { u } = await comOrcamento(100);
  await gasta(u, 90);
  const r = (await u.agente.get(`/api/resumo?mes=${MES}`)).body;
  assert.equal(r.orcamentos[0].status, 'atencao');
});

test('validações e isolamento', async () => {
  const a = await novoUsuario('Ana');
  const b = await novoUsuario('Bia');
  const lazerA = await categoriaDe(a.agente, 'Lazer');
  for (const limite of [0, -5, 'abc', null]) {
    assert.equal((await a.agente.put(`/api/orcamentos/${lazerA.id}`).send({ limite })).status, 400, String(limite));
  }
  assert.equal((await b.agente.put(`/api/orcamentos/${lazerA.id}`).send({ limite: 10 })).status, 404, 'categoria alheia');
  await a.agente.put(`/api/orcamentos/${lazerA.id}`).send({ limite: 10 });
  assert.equal((await orcamento(b)).itens.length, 0);
  assert.equal((await b.agente.delete(`/api/orcamentos/${lazerA.id}`)).status, 404);
  assert.equal((await a.agente.get('/api/orcamentos?mes=2026-13')).status, 400);
});

test('alerta por e-mail aos 80% e aos 100%, uma vez cada', async () => {
  const { u } = await comOrcamento(100);
  await gasta(u, 50);
  assert.equal(emailsPara(u.email).filter(e => /Orçamento/.test(e.assunto)).length, 0);

  await gasta(u, 35); // 85%
  let alertas = emailsPara(u.email).filter(e => /Orçamento/.test(e.assunto));
  assert.equal(alertas.length, 1);
  assert.match(alertas[0].assunto, /Lazer em 85%/);

  await gasta(u, 1); // 86%: mesmo nível, sem novo e-mail
  assert.equal(emailsPara(u.email).filter(e => /Orçamento/.test(e.assunto)).length, 1);

  await gasta(u, 20); // 106%
  alertas = emailsPara(u.email).filter(e => /Orçamento/.test(e.assunto));
  assert.equal(alertas.length, 2);
  assert.match(alertas[1].assunto, /estourado/);

  await gasta(u, 10);
  assert.equal(emailsPara(u.email).filter(e => /Orçamento/.test(e.assunto)).length, 2);
});

test('pular direto para mais de 100% manda só o aviso de estouro', async () => {
  const { u } = await comOrcamento(100);
  await gasta(u, 150);
  const alertas = emailsPara(u.email).filter(e => /Orçamento/.test(e.assunto));
  assert.equal(alertas.length, 1);
  assert.match(alertas[0].assunto, /estourado/);
});

test('sem e-mail confirmado ou com avisos desligados, não manda', async () => {
  const sem = await comOrcamento(100, { verificado: false });
  await gasta(sem.u, 95);
  assert.equal(emailsPara(sem.u.email).filter(e => /Orçamento/.test(e.assunto)).length, 0);

  const off = await comOrcamento(100);
  await off.u.agente.patch('/api/auth/preferencias').send({ notificacoes_email: false });
  await gasta(off.u, 95);
  assert.equal(emailsPara(off.u.email).filter(e => /Orçamento/.test(e.assunto)).length, 0);
});

test('gasto de mês passado não dispara alerta', async () => {
  const { u } = await comOrcamento(100);
  await gasta(u, 500, { data: '2020-01-10' });
  assert.equal(emailsPara(u.email).filter(e => /Orçamento/.test(e.assunto)).length, 0);
});

test('importação e recorrente também disparam o alerta', async () => {
  const { u, lazer } = await comOrcamento(100);
  const conta = (await u.agente.get('/api/contas')).body[0];
  await u.agente.post('/api/importacao/confirmar').send({
    conta_id: conta.id, itens: [{ externo: 'x1', data: HOJE, desc: 'Show', valor: 90, tipo: 'saida', categoria_id: lazer.id }],
  });
  assert.equal(emailsPara(u.email).filter(e => /Orçamento/.test(e.assunto)).length, 1);

  const o2 = await comOrcamento(100);
  const rec = (await o2.u.agente.post('/api/recorrentes').send({ nome: 'Streaming', valor: 95, tipo: 'recorrente', cat: 'Lazer', dia: 1 })).body;
  await o2.u.agente.post(`/api/recorrentes/${rec.id}/lancar`).send({ mes: MES });
  assert.equal(emailsPara(o2.u.email).filter(e => /Orçamento/.test(e.assunto)).length, 1);
});

test('criar um limite que já foi ultrapassado avisa na hora', async () => {
  const u = await novoUsuario();
  confirmarEmail(u.id);
  await gasta(u, 300);
  const lazer = await categoriaDe(u.agente, 'Lazer');
  await u.agente.put(`/api/orcamentos/${lazer.id}`).send({ limite: 100 });
  assert.equal(emailsPara(u.email).filter(e => /estourado/.test(e.assunto)).length, 1);
});

test('categoria com orçamento só some depois de remover o limite', async () => {
  const { u, lazer } = await comOrcamento(100);
  const r = await u.agente.delete(`/api/categorias/${lazer.id}`);
  assert.equal(r.status, 409);
  await u.agente.delete(`/api/orcamentos/${lazer.id}`);
  assert.equal((await u.agente.delete(`/api/categorias/${lazer.id}`)).status, 200);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM orcamentos WHERE user_id = ?').get(u.id).n, 0);
});
