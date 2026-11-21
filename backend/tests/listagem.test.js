const test = require('node:test');
const assert = require('node:assert/strict');
const { novoUsuario, categoriaDe } = require('./helpers');

async function cenario() {
  const u = await novoUsuario();
  const lanca = (d) => u.agente.post('/api/transactions').send({ tipo: 'saida', cat: 'Alimentação', ...d });
  await lanca({ desc: 'Padaria Pão Quente', valor: 12.5, data: '2026-03-01' });
  await lanca({ desc: 'Mercado', valor: 100, data: '2026-03-02', obs: 'compra do mês' });
  await lanca({ desc: 'Salário', valor: 3000, tipo: 'entrada', cat: 'Renda', data: '2026-03-05' });
  await lanca({ desc: 'Cinema', valor: 40, cat: 'Lazer', data: '2026-04-10' });
  await lanca({ desc: '100% desconto', valor: 1, data: '2026-04-11' });
  return u;
}

const get = (u, qs = '') => u.agente.get(`/api/transactions${qs}`).then(r => r.body);

test('ordena do mais recente para o mais antigo e devolve totais', async () => {
  const u = await cenario();
  const r = await get(u);
  assert.equal(r.total, 5);
  assert.deepEqual(r.itens.map(i => i.data), ['2026-04-11', '2026-04-10', '2026-03-05', '2026-03-02', '2026-03-01']);
  assert.equal(r.totais.entradas, 3000);
  assert.equal(r.totais.saidas, 153.5);
  assert.equal(r.totais.saldo, 2846.5);
});

test('filtra por mês, tipo, categoria e conta', async () => {
  const u = await cenario();
  assert.equal((await get(u, '?mes=2026-03')).total, 3);
  assert.equal((await get(u, '?tipo=entrada')).total, 1);
  const lazer = await categoriaDe(u.agente, 'Lazer');
  assert.equal((await get(u, `?categoria_id=${lazer.id}`)).total, 1);
  const [conta] = (await u.agente.get('/api/contas')).body;
  assert.equal((await get(u, `?conta_id=${conta.id}`)).total, 5);
  assert.equal((await get(u, '?conta_id=999999')).total, 0);
});

test('busca ignora acento e maiúsculas e olha a observação', async () => {
  const u = await cenario();
  assert.equal((await get(u, '?q=PAO')).total, 1);
  assert.equal((await get(u, '?q=pão quente')).total, 1);
  assert.equal((await get(u, '?q=do mes')).total, 1);
  assert.equal((await get(u, '?q=nada-disso')).total, 0);
});

test('busca trata % e _ como texto comum', async () => {
  const u = await cenario();
  assert.equal((await get(u, `?q=${encodeURIComponent('100%')}`)).total, 1);
  assert.equal((await get(u, `?q=${encodeURIComponent('%')}`)).total, 1);
  assert.equal((await get(u, `?q=${encodeURIComponent('_')}`)).total, 0);
});

test('totais refletem o filtro inteiro, não só a página', async () => {
  const u = await cenario();
  const r = await get(u, '?mes=2026-03&limite=1&pagina=2');
  assert.equal(r.itens.length, 1);
  assert.equal(r.total, 3);
  assert.equal(r.paginas, 3);
  assert.equal(r.pagina, 2);
  assert.equal(r.totais.entradas, 3000);
  assert.equal(r.totais.saidas, 112.5);
});

test('paginação: limite máximo, página fora do intervalo e valores inválidos', async () => {
  const u = await cenario();
  assert.equal((await get(u, '?limite=9999')).limite, 100);
  assert.equal((await get(u, '?limite=2&pagina=99')).pagina, 3);
  assert.equal((await get(u, '?limite=abc&pagina=-4')).limite, 20);
  const vazio = await get(u, '?q=zzz');
  assert.equal(vazio.pagina, 1);
  assert.equal(vazio.paginas, 1);
  assert.deepEqual(vazio.itens, []);
});

test('filtros inválidos dão 400', async () => {
  const u = await cenario();
  for (const qs of ['?mes=2026-13', '?mes=março', '?tipo=x']) {
    assert.equal((await u.agente.get(`/api/transactions${qs}`)).status, 400, qs);
  }
});

test('filtros e totais nunca vazam dados de outra conta', async () => {
  const a = await cenario();
  const b = await novoUsuario();
  const r = await get(b);
  assert.equal(r.total, 0);
  assert.equal(r.totais.saidas, 0);
  assert.equal((await get(b, '?q=salario')).total, 0);
  assert.equal((await get(a, '?q=salario')).total, 1);
});

test('resumo do mês: totais, quantidades, por dia, por categoria, histórico e últimas', async () => {
  const u = await cenario();
  const r = (await u.agente.get('/api/resumo?mes=2026-03')).body;
  assert.equal(r.entradas, 3000);
  assert.equal(r.saidas, 112.5);
  assert.equal(r.saldo, 2887.5);
  assert.deepEqual(r.qtd, { entradas: 1, saidas: 2, total: 3 });
  assert.equal(r.porDia.length, 31);
  assert.equal(r.porDia[0], 12.5);
  assert.equal(r.porDia[1], 100);
  assert.deepEqual(r.porCategoria, [{ categoria_id: r.porCategoria[0].categoria_id, cat: 'Alimentação', valor: 112.5 }]);
  assert.equal(r.historico.length, 6);
  assert.deepEqual(r.historico.at(-1), { mes: '2026-03', entradas: 3000, saidas: 112.5 });
  assert.equal(r.historico[0].mes, '2025-10');
  assert.equal(r.ultimas.length, 3);
  assert.equal(r.ultimas[0].desc, 'Salário');
});

test('resumo compara com o mês anterior e valida o mês', async () => {
  const u = await cenario();
  const r = (await u.agente.get('/api/resumo?mes=2026-04')).body;
  assert.deepEqual(r.anterior, { entradas: 3000, saidas: 112.5 });
  assert.equal((await u.agente.get('/api/resumo?mes=2026-4')).status, 400);
  const vazio = (await u.agente.get('/api/resumo?mes=2020-01')).body;
  assert.equal(vazio.qtd.total, 0);
  assert.deepEqual(vazio.porCategoria, []);
});
