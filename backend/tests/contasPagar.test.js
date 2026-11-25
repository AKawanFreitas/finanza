const test = require('node:test');
const assert = require('node:assert/strict');
const { db, novoUsuario, categoriaDe, confirmarEmail, emailsPara } = require('./helpers');
const { hojeBR } = require('../lib/datas');
const { vencimentosEmAberto } = require('../lib/vencimentos');
const { enviarLembretes } = require('../lib/lembretes');

// Datas relativas a hoje (fuso do Brasil), para o status ser previsível.
const dia = n => { const d = new Date(Date.parse(`${hojeBR()}T00:00:00Z`) + n * 864e5); return d.toISOString().slice(0, 10); };
const base = (extra = {}) => ({ descricao: 'Conta de luz', valor: 150.75, vencimento: dia(5), cat: 'Moradia', ...extra });
const criar = (u, extra) => u.agente.post('/api/contas-pagar').send(base(extra));
const listar = async (u, qs = '') => (await u.agente.get(`/api/contas-pagar${qs}`)).body;

test('cria conta a pagar: pendente, com dias até vencer', async () => {
  const u = await novoUsuario();
  const r = await criar(u);
  assert.equal(r.status, 201);
  assert.deepEqual([r.body.valor, r.body.status, r.body.dias, r.body.cat, r.body.pago_em], [150.75, 'pendente', 5, 'Moradia', null]);
});

test('status: vence hoje é pendente; ontem é atrasada (com dias negativos)', async () => {
  const u = await novoUsuario();
  const hoje = (await criar(u, { vencimento: dia(0) })).body;
  const ontem = (await criar(u, { vencimento: dia(-1), descricao: 'Atrasada' })).body;
  assert.deepEqual([hoje.status, hoje.dias], ['pendente', 0]);
  assert.deepEqual([ontem.status, ontem.dias], ['atrasada', -1]);
});

test('listagem: em aberto por vencimento (mais urgente primeiro), pagas por último', async () => {
  const u = await novoUsuario();
  await criar(u, { descricao: 'C', vencimento: dia(10) });
  await criar(u, { descricao: 'A', vencimento: dia(-3) });
  const paga = (await criar(u, { descricao: 'P', vencimento: dia(-10) })).body;
  await criar(u, { descricao: 'B', vencimento: dia(2) });
  await u.agente.post(`/api/contas-pagar/${paga.id}/pagar`).send({});
  assert.deepEqual((await listar(u)).itens.map(i => i.descricao), ['A', 'B', 'C', 'P']);
});

test('filtros por status e mês, e totais do que está em aberto', async () => {
  const u = await novoUsuario();
  await criar(u, { descricao: 'Pend', valor: 100, vencimento: dia(3) });
  await criar(u, { descricao: 'Atra', valor: 40.5, vencimento: dia(-2) });
  const paga = (await criar(u, { descricao: 'Paga', valor: 10, vencimento: dia(1) })).body;
  await u.agente.post(`/api/contas-pagar/${paga.id}/pagar`).send({});
  const nomes = async qs => (await listar(u, qs)).itens.map(i => i.descricao).sort();
  assert.deepEqual(await nomes('?status=pendente'), ['Pend']);
  assert.deepEqual(await nomes('?status=atrasada'), ['Atra']);
  assert.deepEqual(await nomes('?status=paga'), ['Paga']);
  assert.deepEqual(await nomes('?status=abertas'), ['Atra', 'Pend']);
  assert.deepEqual(await nomes(`?mes=${dia(3).slice(0, 7)}&status=abertas`).then(n => n.length > 0), true);
  assert.deepEqual((await listar(u)).totais, { pendente: 100, atrasado: 40.5, qtd_atrasadas: 1 });
  assert.equal((await u.agente.get('/api/contas-pagar?status=xyz')).status, 400);
  assert.equal((await u.agente.get('/api/contas-pagar?mes=2026-13')).status, 400);
});

test('pagar gera a saída com os dados da conta e marca como paga', async () => {
  const u = await novoUsuario();
  const cp = (await criar(u, { obs: 'Ref. fevereiro' })).body;
  const r = await u.agente.post(`/api/contas-pagar/${cp.id}/pagar`).send({ data: dia(-1) });
  assert.equal(r.status, 200);
  assert.deepEqual([r.body.status, r.body.pago_em, r.body.dias], ['paga', dia(-1), null]);
  const lanc = (await u.agente.get('/api/transactions')).body.itens;
  assert.equal(lanc.length, 1);
  assert.deepEqual([lanc[0].desc, lanc[0].valor, lanc[0].tipo, lanc[0].cat, lanc[0].data, lanc[0].obs],
    ['Conta de luz', 150.75, 'saida', 'Moradia', dia(-1), 'Ref. fevereiro']);
});

test('pagar usa a conta informada, depois a planejada, depois a principal', async () => {
  const u = await novoUsuario();
  const reserva = (await u.agente.post('/api/contas').send({ nome: 'Reserva', tipo: 'poupanca' })).body;
  const outra = (await u.agente.post('/api/contas').send({ nome: 'Outra', tipo: 'corrente' })).body;
  const planejada = (await criar(u, { conta_id: reserva.id, descricao: 'P1' })).body;
  const semConta = (await criar(u, { descricao: 'P2' })).body;
  const informada = (await criar(u, { conta_id: reserva.id, descricao: 'P3' })).body;
  await u.agente.post(`/api/contas-pagar/${planejada.id}/pagar`).send({});
  await u.agente.post(`/api/contas-pagar/${semConta.id}/pagar`).send({});
  await u.agente.post(`/api/contas-pagar/${informada.id}/pagar`).send({ conta_id: outra.id });
  const contaDe = async desc => (await u.agente.get(`/api/transactions?q=${desc}`)).body.itens[0].conta;
  assert.equal(await contaDe('P1'), 'Reserva');
  assert.equal(await contaDe('P2'), 'Conta principal');
  assert.equal(await contaDe('P3'), 'Outra');
});

test('não paga duas vezes; editar conta paga é recusado', async () => {
  const u = await novoUsuario();
  const cp = (await criar(u)).body;
  assert.equal((await u.agente.post(`/api/contas-pagar/${cp.id}/pagar`).send({})).status, 200);
  assert.equal((await u.agente.post(`/api/contas-pagar/${cp.id}/pagar`).send({})).status, 409);
  assert.equal((await u.agente.put(`/api/contas-pagar/${cp.id}`).send(base())).status, 409);
  assert.equal((await u.agente.get('/api/transactions')).body.total, 1, 'só um lançamento');
});

test('desfazer o pagamento apaga o lançamento e reabre a conta', async () => {
  const u = await novoUsuario();
  const cp = (await criar(u)).body;
  await u.agente.post(`/api/contas-pagar/${cp.id}/pagar`).send({});
  const r = await u.agente.post(`/api/contas-pagar/${cp.id}/desfazer`);
  assert.equal(r.body.status, 'pendente');
  assert.equal((await u.agente.get('/api/transactions')).body.total, 0);
  assert.equal((await u.agente.post(`/api/contas-pagar/${cp.id}/desfazer`)).status, 409, 'já está em aberto');
});

test('apagar o lançamento gerado também reabre a conta (status derivado, não gravado)', async () => {
  const u = await novoUsuario();
  const cp = (await criar(u)).body;
  await u.agente.post(`/api/contas-pagar/${cp.id}/pagar`).send({});
  const tx = (await u.agente.get('/api/transactions')).body.itens[0];
  await u.agente.delete(`/api/transactions/${tx.id}`);
  const item = (await listar(u)).itens[0];
  assert.equal(item.status, 'pendente');
  assert.equal(item.transacao_id, null);
});

test('excluir a conta paga mantém o lançamento', async () => {
  const u = await novoUsuario();
  const cp = (await criar(u)).body;
  await u.agente.post(`/api/contas-pagar/${cp.id}/pagar`).send({});
  assert.equal((await u.agente.delete(`/api/contas-pagar/${cp.id}`)).status, 200);
  assert.equal((await u.agente.get('/api/transactions')).body.total, 1);
});

test('editar conta em aberto', async () => {
  const u = await novoUsuario();
  const cp = (await criar(u)).body;
  const r = await u.agente.put(`/api/contas-pagar/${cp.id}`).send(base({ descricao: 'Luz ajustada', valor: 200, vencimento: dia(9), cat: 'Lazer' }));
  assert.deepEqual([r.body.descricao, r.body.valor, r.body.vencimento, r.body.cat], ['Luz ajustada', 200, dia(9), 'Lazer']);
});

test('pagar conta dispara o alerta de orçamento da categoria', async () => {
  const u = await novoUsuario();
  confirmarEmail(u.id);
  const moradia = await categoriaDe(u.agente, 'Moradia');
  await u.agente.put(`/api/orcamentos/${moradia.id}`).send({ limite: 200 });
  const cp = (await criar(u, { valor: 190 })).body;
  await u.agente.post(`/api/contas-pagar/${cp.id}/pagar`).send({});
  assert.equal(emailsPara(u.email).filter(e => /Orçamento de Moradia/.test(e.assunto)).length, 1);
});

test('validações', async () => {
  const u = await novoUsuario();
  const casos = [
    [{ descricao: ' ' }, /descrição/i], [{ valor: 0 }, /maior que zero/], [{ vencimento: '10/03/2026' }, /AAAA-MM-DD/],
    [{ vencimento: '2026-02-31' }, /inexistente/i], [{ cat: 'Não existe' }, /Categoria não encontrada/], [{ conta_id: 999999 }, /Conta/],
  ];
  for (const [extra, regex] of casos) {
    const r = await criar(u, extra);
    assert.equal(r.status, 400, JSON.stringify(extra));
    assert.match(r.body.error, regex, JSON.stringify(extra));
  }
  const cp = (await criar(u)).body;
  assert.equal((await u.agente.post(`/api/contas-pagar/${cp.id}/pagar`).send({ data: 'ontem' })).status, 400);
  assert.equal((await u.agente.post(`/api/contas-pagar/${cp.id}/pagar`).send({ conta_id: 999999 })).status, 400);
});

test('isolamento: nada de outro usuário aparece nem pode ser alterado', async () => {
  const a = await novoUsuario('Ana');
  const b = await novoUsuario('Bia');
  const cp = (await criar(a)).body;
  assert.deepEqual((await listar(b)).itens, []);
  assert.equal((await b.agente.put(`/api/contas-pagar/${cp.id}`).send(base())).status, 404);
  assert.equal((await b.agente.post(`/api/contas-pagar/${cp.id}/pagar`).send({})).status, 404);
  assert.equal((await b.agente.post(`/api/contas-pagar/${cp.id}/desfazer`)).status, 404);
  assert.equal((await b.agente.delete(`/api/contas-pagar/${cp.id}`)).status, 404);
  const contaA = (await a.agente.get('/api/contas')).body[0];
  assert.equal((await criar(b, { conta_id: contaA.id })).status, 400, 'conta alheia');
  const catA = await categoriaDe(a.agente, 'Lazer');
  assert.equal((await b.agente.post('/api/contas-pagar').send(base({ cat: undefined, categoria_id: catA.id }))).status, 400, 'categoria alheia');
  assert.equal((await listar(a)).itens.length, 1);
});

test('excluir o usuário com contas a pagar (pagas e abertas) não esbarra nas FKs', async () => {
  const u = await novoUsuario();
  const paga = (await criar(u)).body;
  await criar(u, { descricao: 'Aberta' });
  await u.agente.post(`/api/contas-pagar/${paga.id}/pagar`).send({});
  assert.equal((await u.agente.delete('/api/auth/conta').send({ senha: u.senha })).status, 200);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM contas_pagar WHERE user_id = ?').get(u.id).n, 0);
});

/* ── Próximos vencimentos (contas + faturas) ──────── */

async function comCartaoEVencimentos() {
  const u = await novoUsuario();
  // Cartão que fechou há 10 dias e vence em 5 (datas montadas a partir de hoje).
  const hoje = new Date(Date.parse(`${hojeBR()}T00:00:00Z`));
  const fecha = new Date(hoje.getTime() - 10 * 864e5).getUTCDate();
  const vence = new Date(hoje.getTime() + 5 * 864e5).getUTCDate();
  const cartao = (await u.agente.post('/api/cartoes').send({ nome: 'Roxinho', limite: 3000, dia_fechamento: fecha, dia_vencimento: vence })).body;
  await u.agente.post('/api/transactions').send({ desc: 'Compra', valor: 300, tipo: 'saida', cat: 'Outros', data: dia(-20), conta_id: cartao.id });
  await criar(u, { descricao: 'Internet', vencimento: dia(2) });
  await criar(u, { descricao: 'Aluguel', vencimento: dia(-4) });
  return { u, cartao };
}

test('vencimentos em aberto juntam contas e faturas fechadas, do mais antigo ao mais novo', async () => {
  const { u } = await comCartaoEVencimentos();
  const itens = vencimentosEmAberto(u.id);
  assert.deepEqual(itens.map(i => i.tipo), ['conta', 'conta', 'fatura']);
  assert.deepEqual(itens.map(i => i.titulo.split(' ')[0]), ['Aluguel', 'Internet', 'Fatura']);
  assert.equal(itens[0].atrasada, true);
  assert.equal(itens[2].valor, 300);
});

test('o resumo do dashboard traz os próximos vencimentos', async () => {
  const { u } = await comCartaoEVencimentos();
  const r = (await u.agente.get('/api/resumo')).body;
  assert.equal(r.vencimentos.length, 3);
});

test('fatura quitada e conta paga saem dos vencimentos', async () => {
  const { u, cartao } = await comCartaoEVencimentos();
  const principal = (await u.agente.get('/api/contas')).body.find(c => c.tipo === 'corrente');
  const mes = (await u.agente.get(`/api/cartoes/${cartao.id}/faturas`)).body[0].mes;
  await u.agente.post(`/api/cartoes/${cartao.id}/faturas/${mes}/pagar`).send({ origem_id: principal.id });
  const aluguel = (await listar(u)).itens.find(i => i.descricao === 'Aluguel');
  await u.agente.post(`/api/contas-pagar/${aluguel.id}/pagar`).send({});
  assert.deepEqual(vencimentosEmAberto(u.id).map(i => i.titulo), ['Internet']);
});

/* ── Lembretes por e-mail ─────────────────────────── */

const AGORA = new Date('2026-03-10T15:00:00Z'); // 12h em Brasília
const lembretes = u => emailsPara(u.email).filter(e => /vence|atrasad/i.test(e.assunto));
const dataRel = n => new Date(Date.parse('2026-03-10T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);

async function comLembretes(contas) {
  const u = await novoUsuario();
  confirmarEmail(u.id);
  for (const c of contas) await criar(u, c);
  return u;
}

test('lembrete: um e-mail só com tudo que vence em até 3 dias, e depois não repete', async () => {
  const u = await comLembretes([
    { descricao: 'Luz', vencimento: dataRel(1) }, { descricao: 'Água', vencimento: dataRel(3) },
    { descricao: 'Longe', vencimento: dataRel(4) }, { descricao: 'Hoje', vencimento: dataRel(0) },
  ]);
  assert.equal(enviarLembretes(AGORA) >= 3, true);
  const [e] = lembretes(u);
  assert.equal(lembretes(u).length, 1, 'um único e-mail');
  assert.match(e.assunto, /3 contas vencem/);
  assert.match(e.texto, /Luz/); assert.match(e.texto, /Água/); assert.match(e.texto, /Hoje/);
  assert.doesNotMatch(e.texto, /Longe/);
  enviarLembretes(AGORA);
  enviarLembretes(new Date('2026-03-10T20:00:00Z'));
  assert.equal(lembretes(u).length, 1, 'sem repetição no mesmo dia');
});

test('atrasadas viram um segundo aviso, uma vez; muito antigas não são cobradas', async () => {
  const u = await comLembretes([{ descricao: 'Luz', vencimento: dataRel(1) }, { descricao: 'Velha', vencimento: dataRel(-40) }]);
  enviarLembretes(AGORA);
  assert.equal(lembretes(u).length, 1);
  const depois = new Date('2026-03-13T15:00:00Z'); // a Luz venceu há 2 dias
  enviarLembretes(depois);
  const avisos = lembretes(u);
  assert.equal(avisos.length, 2);
  assert.match(avisos[1].assunto, /atrasada/i);
  assert.doesNotMatch(avisos[1].texto, /Velha/);
  enviarLembretes(new Date('2026-03-14T15:00:00Z'));
  assert.equal(lembretes(u).length, 2, 'a cobrança de atraso é uma vez só');
});

test('fatura de cartão também gera lembrete', async () => {
  const u = await novoUsuario();
  confirmarEmail(u.id);
  const cartao = (await u.agente.post('/api/cartoes').send({ nome: 'Roxinho', limite: 3000, dia_fechamento: 5, dia_vencimento: 12 })).body;
  await u.agente.post('/api/transactions').send({ desc: 'Compra', valor: 480, tipo: 'saida', cat: 'Outros', data: '2026-03-02', conta_id: cartao.id });
  enviarLembretes(AGORA); // fatura de mar/2026: fechou dia 5, vence dia 12 (em 2 dias)
  const [e] = lembretes(u);
  assert.ok(e, 'recebeu o lembrete');
  assert.match(e.texto, /Fatura Roxinho/);
  assert.match(e.texto, /480,00/);
});

test('não manda de madrugada, sem e-mail confirmado ou com avisos desligados', async () => {
  const u = await comLembretes([{ descricao: 'Luz', vencimento: dataRel(1) }]);
  enviarLembretes(new Date('2026-03-10T08:00:00Z')); // 05h em Brasília
  assert.equal(lembretes(u).length, 0);

  const sem = await novoUsuario();
  await criar(sem, { descricao: 'Luz', vencimento: dataRel(1) });
  const off = await comLembretes([{ descricao: 'Luz', vencimento: dataRel(1) }]);
  await off.agente.patch('/api/auth/preferencias').send({ notificacoes_email: false });
  enviarLembretes(AGORA);
  assert.equal(lembretes(sem).length, 0);
  assert.equal(lembretes(off).length, 0);
  assert.equal(lembretes(u).length, 1, 'e o primeiro recebe depois das 7h');
});

test('conta paga não gera lembrete', async () => {
  const u = await comLembretes([{ descricao: 'Luz', vencimento: dataRel(1) }]);
  const cp = (await listar(u)).itens[0];
  await u.agente.post(`/api/contas-pagar/${cp.id}/pagar`).send({});
  enviarLembretes(AGORA);
  assert.equal(lembretes(u).length, 0);
});

test('o lembrete de um usuário nunca mostra contas de outro', async () => {
  const a = await comLembretes([{ descricao: 'Segredo da Ana', vencimento: dataRel(1) }]);
  const b = await comLembretes([{ descricao: 'Da Bia', vencimento: dataRel(1) }]);
  enviarLembretes(AGORA);
  assert.doesNotMatch(lembretes(b)[0].texto, /Ana/);
  assert.doesNotMatch(lembretes(a)[0].texto, /Bia/);
});

test('o lançamento gerado pelo pagamento não é editado por fora: a conta paga não fica com outro valor', async () => {
  const u = await novoUsuario();
  const cp = (await criar(u)).body;
  const paga = (await u.agente.post(`/api/contas-pagar/${cp.id}/pagar`).send({})).body;

  const r = await u.agente.put(`/api/transactions/${paga.transacao_id}`)
    .send({ desc: 'Conta de luz', valor: 1, tipo: 'entrada', data: hojeBR(), cat: 'Moradia' });
  assert.equal(r.status, 409);
  assert.match(r.body.error, /Desfaça o pagamento/);
  assert.equal(db.prepare('SELECT valor_centavos, tipo FROM transactions WHERE id = ?').get(paga.transacao_id).tipo, 'saida');
});
