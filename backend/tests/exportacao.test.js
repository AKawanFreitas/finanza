const test = require('node:test');
const assert = require('node:assert/strict');
const { novoUsuario } = require('./helpers');

async function cenario() {
  const u = await novoUsuario();
  const lanca = d => u.agente.post('/api/transactions').send({ tipo: 'saida', cat: 'Alimentação', ...d });
  await lanca({ desc: 'Mercado; "central"', valor: 1234.5, data: '2026-03-02', obs: 'linha1\nlinha2' });
  await lanca({ desc: 'Salário', valor: 5000, tipo: 'entrada', cat: 'Renda', data: '2026-03-05' });
  await lanca({ desc: '=HYPERLINK("http://x")', valor: 9.9, cat: 'Outros', data: '2026-04-01' });
  return u;
}

const baixar = (u, qs) => u.agente.get(`/api/exportacao/lancamentos${qs}`).buffer(true).parse((res, cb) => {
  const partes = []; res.on('data', c => partes.push(c)); res.on('end', () => cb(null, Buffer.concat(partes)));
});

test('CSV: BOM, separador ;, vírgula decimal, datas BR e cabeçalho', async () => {
  const u = await cenario();
  const r = await baixar(u, '?formato=csv&mes=2026-03');
  assert.equal(r.status, 200);
  assert.match(r.headers['content-type'], /text\/csv/);
  assert.match(r.headers['content-disposition'], /lancamentos-2026-03\.csv/);
  const texto = r.body.toString('utf8');
  assert.equal(texto.charCodeAt(0), 0xFEFF, 'BOM para o Excel reconhecer UTF-8');
  const linhas = texto.slice(1).split('\r\n');
  assert.equal(linhas[0], 'Data;Descrição;Tipo;Categoria;Conta;Valor;Observação');
  assert.equal(linhas[2].split(';')[0], '02/03/2026');
  assert.ok(linhas[1].startsWith('05/03/2026;Salário;Entrada;Renda;Conta principal;5000,00;'));
});

test('CSV: aspas, ; e quebra de linha dentro de campos ficam entre aspas', async () => {
  const u = await cenario();
  const texto = (await baixar(u, '?mes=2026-03')).body.toString('utf8');
  assert.ok(texto.includes('"Mercado; ""central"""'));
  assert.ok(texto.includes('"linha1\nlinha2"'));
  assert.ok(texto.includes(';1234,50;'));
});

test('CSV: texto que começa com = vira texto, não fórmula', async () => {
  const u = await cenario();
  const texto = (await baixar(u, '?mes=2026-04')).body.toString('utf8');
  assert.ok(texto.includes(`'=HYPERLINK`), 'apóstrofo antes do =');
  assert.ok(!/;=HYPERLINK|^=HYPERLINK/m.test(texto));
});

test('respeita os mesmos filtros da listagem', async () => {
  const u = await cenario();
  const linhas = async qs => (await baixar(u, qs)).body.toString('utf8').trim().split('\r\n').length - 1;
  assert.equal(await linhas('?mes=2026-03'), 2);
  assert.equal(await linhas('?tipo=entrada'), 1);
  assert.equal(await linhas('?q=salario'), 1);
  assert.equal(await linhas(''), 3);
});

test('XLSX: devolve um arquivo zip (xlsx) com o tipo certo', async () => {
  const u = await cenario();
  const r = await baixar(u, '?formato=xlsx&mes=2026-03');
  assert.equal(r.status, 200);
  assert.match(r.headers['content-type'], /spreadsheetml\.sheet/);
  assert.match(r.headers['content-disposition'], /\.xlsx/);
  assert.equal(r.body.subarray(0, 2).toString(), 'PK');
  assert.ok(r.body.length > 1000);
});

test('formato inválido e filtro inválido dão 400', async () => {
  const u = await cenario();
  assert.equal((await u.agente.get('/api/exportacao/lancamentos?formato=pdf')).status, 400);
  assert.equal((await u.agente.get('/api/exportacao/lancamentos?mes=abc')).status, 400);
});

test('só exporta os dados do próprio usuário e exige login', async () => {
  await cenario();
  const outro = await novoUsuario();
  const texto = (await baixar(outro, '')).body.toString('utf8').trim();
  assert.equal(texto.slice(1).split('\r\n').length, 1, 'só o cabeçalho');
  const { request, app } = require('./helpers');
  assert.equal((await request(app).get('/api/exportacao/lancamentos')).status, 401);
});
