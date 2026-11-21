const test = require('node:test');
const assert = require('node:assert/strict');
const { db, novoUsuario, confirmarEmail, emailsPara } = require('./helpers');
const { mesesAte, statusDe } = require('../lib/metas');
const { hojeBR } = require('../lib/datas');

const base = (extra = {}) => ({ nome: 'Viagem', valor_alvo: 1000, ...extra });
const criar = async (u, extra) => (await u.agente.post('/api/metas').send(base(extra)));
const aportar = (u, meta, corpo) => u.agente.post(`/api/metas/${meta.id}/aportes`).send(corpo);
const obter = async (u, id) => (await u.agente.get('/api/metas')).body.find(m => m.id === id);
const emMeses = n => { const d = new Date(Date.now() - 3 * 3600e3); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); };

/* ── Regras puras ─────────────────────────────────── */

test('meses até o prazo contam o mês atual; prazo neste mês vale 1; passado vale 0', () => {
  assert.equal(mesesAte('2026-03-20', '2026-03-05'), 1);
  assert.equal(mesesAte('2026-06-01', '2026-03-31'), 3);
  assert.equal(mesesAte('2027-01-15', '2026-11-20'), 2);
  assert.equal(mesesAte('2026-03-01', '2026-03-05'), 0);
});

test('status: concluída, atrasada ou em andamento', () => {
  assert.equal(statusDe(1000, 1000, '2020-01-01', '2026-03-05'), 'concluida', 'concluir vence o atraso');
  assert.equal(statusDe(500, 1000, '2026-03-01', '2026-03-05'), 'atrasada');
  assert.equal(statusDe(500, 1000, '2026-03-05', '2026-03-05'), 'em_andamento', 'o dia do prazo ainda vale');
  assert.equal(statusDe(500, 1000, null, '2026-03-05'), 'em_andamento');
});

/* ── Metas ────────────────────────────────────────── */

test('cria meta: começa zerada, sem prazo e sem sugestão', async () => {
  const u = await novoUsuario();
  const r = await criar(u);
  assert.equal(r.status, 201);
  assert.deepEqual([r.body.valor_alvo, r.body.atual, r.body.restante, r.body.percentual, r.body.status, r.body.sugestao_mensal], [1000, 0, 1000, 0, 'em_andamento', null]);
});

test('valor inicial vira o primeiro aporte', async () => {
  const u = await novoUsuario();
  const r = await criar(u, { valor_inicial: 250 });
  assert.equal(r.body.atual, 250);
  assert.equal(r.body.aportes, 1);
});

test('aportes e retiradas atualizam o progresso', async () => {
  const u = await novoUsuario();
  const { body: meta } = await criar(u);
  await aportar(u, meta, { valor: 300.5 });
  await aportar(u, meta, { valor: 100, tipo: 'retirada' });
  const m = await obter(u, meta.id);
  assert.deepEqual([m.atual, m.restante, m.percentual], [200.5, 799.5, 20]);
});

test('sugestão mensal: o que falta dividido pelos meses até o prazo, arredondado para cima', async () => {
  const u = await novoUsuario();
  const { body: meta } = await criar(u, { valor_alvo: 1000, prazo: emMeses(3) });
  const m = await obter(u, meta.id);
  assert.equal(m.meses_restantes, 3);
  assert.equal(m.sugestao_mensal, 333.34, '1000/3 = 333,33... para cima');
  await aportar(u, meta, { valor: 400 });
  assert.equal((await obter(u, meta.id)).sugestao_mensal, 200);
});

test('atrasada: prazo passou e falta valor; sem sugestão', async () => {
  const u = await novoUsuario();
  const { body: meta } = await criar(u, { prazo: '2020-01-01' });
  const m = await obter(u, meta.id);
  assert.equal(m.status, 'atrasada');
  assert.equal(m.sugestao_mensal, null);
});

test('concluída ao atingir o alvo, mesmo passando dele', async () => {
  const u = await novoUsuario();
  const { body: meta } = await criar(u, { valor_alvo: 500 });
  await aportar(u, meta, { valor: 600 });
  const m = await obter(u, meta.id);
  assert.equal(m.status, 'concluida');
  assert.equal(m.restante, 0);
  assert.equal(m.percentual, 120);
});

test('percentual arredonda para baixo (99,9% não vira 100%)', async () => {
  const u = await novoUsuario();
  const { body: meta } = await criar(u, { valor_alvo: 1000 });
  await aportar(u, meta, { valor: 999.99 });
  const m = await obter(u, meta.id);
  assert.equal(m.percentual, 99.9);
  assert.equal(m.status, 'em_andamento');
});

test('não retira mais do que há; remover aporte não deixa saldo negativo', async () => {
  const u = await novoUsuario();
  const { body: meta } = await criar(u);
  const a1 = (await aportar(u, meta, { valor: 100 })).body.aporte;
  assert.equal((await aportar(u, meta, { valor: 100.01, tipo: 'retirada' })).status, 400);
  await aportar(u, meta, { valor: 80, tipo: 'retirada' });
  const r = await u.agente.delete(`/api/metas/${meta.id}/aportes/${a1.id}`);
  assert.equal(r.status, 409, 'sobraria -80');
  assert.equal((await obter(u, meta.id)).atual, 20);
});

test('remover um aporte recalcula o progresso', async () => {
  const u = await novoUsuario();
  const { body: meta } = await criar(u);
  const a = (await aportar(u, meta, { valor: 100 })).body.aporte;
  await aportar(u, meta, { valor: 50 });
  const r = await u.agente.delete(`/api/metas/${meta.id}/aportes/${a.id}`);
  assert.equal(r.body.meta.atual, 50);
});

test('histórico de aportes: mais recente primeiro, com tipo e valor positivo', async () => {
  const u = await novoUsuario();
  const { body: meta } = await criar(u);
  await aportar(u, meta, { valor: 100, data: '2026-03-01' });
  await aportar(u, meta, { valor: 30, tipo: 'retirada', data: '2026-03-05', obs: 'Imprevisto' });
  const lista = (await u.agente.get(`/api/metas/${meta.id}/aportes`)).body;
  assert.deepEqual(lista.map(a => [a.tipo, a.valor, a.data]), [['retirada', 30, '2026-03-05'], ['aporte', 100, '2026-03-01']]);
  assert.equal(lista[0].obs, 'Imprevisto');
});

test('editar, arquivar e excluir (a exclusão leva os aportes)', async () => {
  const u = await novoUsuario();
  const { body: meta } = await criar(u, { valor_inicial: 100 });
  const put = await u.agente.put(`/api/metas/${meta.id}`).send(base({ nome: 'Viagem 2027', valor_alvo: 2000, prazo: '2027-12-31', arquivada: true }));
  assert.deepEqual([put.body.nome, put.body.valor_alvo, put.body.prazo, put.body.arquivada], ['Viagem 2027', 2000, '2027-12-31', true]);
  assert.equal((await u.agente.delete(`/api/metas/${meta.id}`)).status, 200);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM aportes WHERE meta_id = ?').get(meta.id).n, 0);
  assert.equal((await u.agente.delete(`/api/metas/${meta.id}`)).status, 404);
});

test('ordenação: ativas por prazo mais próximo, sem prazo depois, arquivadas por último', async () => {
  const u = await novoUsuario();
  await criar(u, { nome: 'Sem prazo' });
  await criar(u, { nome: 'Longe', prazo: '2030-01-01' });
  await criar(u, { nome: 'Perto', prazo: '2028-01-01' });
  const arq = (await criar(u, { nome: 'Velha', prazo: '2027-01-01' })).body;
  await u.agente.put(`/api/metas/${arq.id}`).send(base({ nome: 'Velha', prazo: '2027-01-01', arquivada: true }));
  assert.deepEqual((await u.agente.get('/api/metas')).body.map(m => m.nome), ['Perto', 'Longe', 'Sem prazo', 'Velha']);
});

test('validações', async () => {
  const u = await novoUsuario();
  const casos = [
    [{ nome: '' }, /nome/i], [{ valor_alvo: 0 }, /maior que zero/], [{ valor_alvo: 'x' }, /maior que zero/],
    [{ prazo: '31/12/2027' }, /AAAA-MM-DD/], [{ prazo: '2027-02-30' }, /inexistente/i], [{ cor: 'verde' }, /cor/i], [{ valor_inicial: -1 }, /inicial/],
  ];
  for (const [extra, regex] of casos) {
    const r = await criar(u, extra);
    assert.equal(r.status, 400, JSON.stringify(extra));
    assert.match(r.body.error, regex, JSON.stringify(extra));
  }
  await criar(u);
  assert.equal((await criar(u, { nome: 'viagem' })).status, 409);
  const { body: meta } = await criar(u, { nome: 'Outra' });
  for (const corpo of [{ valor: 0 }, { valor: 'a' }, { valor: 5, tipo: 'doação' }, { valor: 5, data: '2026-13-01' }]) {
    assert.equal((await aportar(u, meta, corpo)).status, 400, JSON.stringify(corpo));
  }
});

test('isolamento: ninguém vê, altera, apaga nem aporta na meta de outro usuário', async () => {
  const a = await novoUsuario('Ana');
  const b = await novoUsuario('Bia');
  const { body: meta } = await criar(a, { valor_inicial: 100 });
  const aporte = (await a.agente.get(`/api/metas/${meta.id}/aportes`)).body[0];
  assert.deepEqual((await b.agente.get('/api/metas')).body, []);
  assert.equal((await b.agente.put(`/api/metas/${meta.id}`).send(base())).status, 404);
  assert.equal((await b.agente.delete(`/api/metas/${meta.id}`)).status, 404);
  assert.equal((await b.agente.get(`/api/metas/${meta.id}/aportes`)).status, 404);
  assert.equal((await aportar(b, meta, { valor: 10 })).status, 404);
  assert.equal((await b.agente.delete(`/api/metas/${meta.id}/aportes/${aporte.id}`)).status, 404);
  assert.equal((await obter(a, meta.id)).atual, 100);
});

test('o aporte de outra meta do mesmo usuário não pode ser removido pela meta errada', async () => {
  const u = await novoUsuario();
  const { body: m1 } = await criar(u, { nome: 'Um' });
  const { body: m2 } = await criar(u, { nome: 'Dois' });
  const a = (await aportar(u, m1, { valor: 10 })).body.aporte;
  assert.equal((await u.agente.delete(`/api/metas/${m2.id}/aportes/${a.id}`)).status, 404);
});

test('e-mail "meta atingida" uma única vez, só com e-mail confirmado', async () => {
  const sem = await novoUsuario();
  const { body: m0 } = await criar(sem, { valor_alvo: 100 });
  await aportar(sem, m0, { valor: 100 });
  assert.equal(emailsPara(sem.email).filter(e => /Meta atingida/.test(e.assunto)).length, 0);

  const u = await novoUsuario();
  confirmarEmail(u.id);
  const { body: meta } = await criar(u, { valor_alvo: 100 });
  await aportar(u, meta, { valor: 60 });
  assert.equal(emailsPara(u.email).filter(e => /Meta atingida/.test(e.assunto)).length, 0);
  await aportar(u, meta, { valor: 50 });
  await aportar(u, meta, { valor: 10 });
  const avisos = emailsPara(u.email).filter(e => /Meta atingida/.test(e.assunto));
  assert.equal(avisos.length, 1);
  assert.match(avisos[0].texto, /110,00/);
});

test('excluir o usuário com metas e aportes não esbarra nas FKs', async () => {
  const u = await novoUsuario();
  const { body: meta } = await criar(u, { valor_inicial: 50 });
  await aportar(u, meta, { valor: 5 });
  assert.equal((await u.agente.delete('/api/auth/conta').send({ senha: u.senha })).status, 200);
  for (const t of ['metas', 'aportes']) assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE user_id = ?`).get(u.id).n, 0, t);
});

test('hoje no Brasil é usado como data padrão do aporte', async () => {
  const u = await novoUsuario();
  const { body: meta } = await criar(u);
  await aportar(u, meta, { valor: 1 });
  assert.equal((await u.agente.get(`/api/metas/${meta.id}/aportes`)).body[0].data, hojeBR());
});
