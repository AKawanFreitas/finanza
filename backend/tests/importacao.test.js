const test = require('node:test');
const assert = require('node:assert/strict');
const { novoUsuario, categoriaDe, db } = require('./helpers');
const { lerOfx } = require('../lib/importacao/ofx');
const { lerCsv, parseValor, parseData } = require('../lib/importacao/csv');

// OFX 1.x (SGML): sem tags de fechamento, como a maioria dos bancos brasileiros exporta.
const OFX_SGML = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
CHARSET:1252

<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260310120000[-3:BRT]
<TRNAMT>-45.90
<FITID>20260310001
<MEMO>SUPERMERCADO EXTRA
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260315
<TRNAMT>5000.00
<FITID>20260315002
<NAME>SALARIO
<MEMO>Crédito de salário
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260316
<TRNAMT>-1.234,56
<FITID>20260316003
<MEMO>Aluguel &amp; condomínio
</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

// OFX 2.x (XML) com cartão de crédito.
const OFX_XML = `<?xml version="1.0"?><OFX><CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20260301</DTPOSTED><TRNAMT>-89.90</TRNAMT><FITID>A1</FITID><NAME>UBER *TRIP</NAME></STMTTRN>
<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20260302</DTPOSTED><TRNAMT>-12.00</TRNAMT><FITID>A2</FITID><NAME>PADARIA</NAME></STMTTRN>
</BANKTRANLIST></CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1></OFX>`;

test('OFX SGML: datas, sinais, ids, nome/memo e entidades', () => {
  const { itens, ignoradas } = lerOfx(OFX_SGML);
  assert.equal(ignoradas, 0);
  assert.equal(itens.length, 3);
  assert.deepEqual(itens[0], { data: '2026-03-10', desc: 'SUPERMERCADO EXTRA', valor: -45.9, externo: 'ofx:20260310001', obs: '' });
  assert.equal(itens[1].desc, 'SALARIO');
  assert.equal(itens[1].obs, 'Crédito de salário');
  assert.equal(itens[1].valor, 5000);
  assert.equal(itens[2].desc, 'Aluguel & condomínio');
  assert.equal(itens[2].valor, -1234.56, 'aceita vírgula decimal');
});

test('OFX XML (cartão): lê os mesmos campos', () => {
  const { itens } = lerOfx(OFX_XML);
  assert.deepEqual(itens.map(i => [i.data, i.desc, i.valor]), [['2026-03-01', 'UBER *TRIP', -89.9], ['2026-03-02', 'PADARIA', -12]]);
});

test('OFX: transação sem data ou valor é ignorada', () => {
  const { itens, ignoradas } = lerOfx('<OFX><STMTTRN><DTPOSTED>lixo<TRNAMT>10</STMTTRN><STMTTRN><DTPOSTED>20260101<TRNAMT>0</STMTTRN><STMTTRN><DTPOSTED>20260101<TRNAMT>5<FITID>1<NAME>ok</STMTTRN></OFX>');
  assert.equal(itens.length, 1);
  assert.equal(ignoradas, 2);
});

test('CSV: valores e datas no formato brasileiro', () => {
  for (const [entrada, esperado] of [['1.234,56', 1234.56], ['-1.234,56', -1234.56], ['(50,00)', -50], ['R$ 10,5', 10.5], ['1234.56', 1234.56], ['1,234.56', 1234.56], ['12,34-', -12.34], ['abc', null], ['', null]]) {
    assert.equal(parseValor(entrada), esperado, entrada);
  }
  assert.equal(parseData('05/03/2026'), '2026-03-05');
  assert.equal(parseData('5/3/2026'), '2026-03-05');
  assert.equal(parseData('2026-03-05'), '2026-03-05');
  assert.equal(parseData('31/02/2026'), null);
});

test('CSV: separador ; com aspas e valor com sinal', () => {
  const { itens } = lerCsv('Data;Descrição;Valor\n15/03/2026;"Mercado; Extra";-1.234,56\n16/03/2026;Salário;5000,00\n');
  assert.deepEqual(itens.map(i => [i.data, i.desc, i.valor]), [['2026-03-15', 'Mercado; Extra', -1234.56], ['2026-03-16', 'Salário', 5000]]);
});

test('CSV: colunas separadas de débito e crédito, BOM e CRLF', () => {
  const csv = '﻿Data,Histórico,Débito,Crédito\r\n01/03/2026,PIX enviado,100.00,\r\n02/03/2026,PIX recebido,,250.00\r\n';
  const { itens } = lerCsv(csv);
  assert.deepEqual(itens.map(i => i.valor), [-100, 250]);
});

test('CSV: cabeçalho irreconhecível diz quais colunas foram achadas', () => {
  assert.throws(() => lerCsv('foo;bar\n1;2\n'), /Colunas encontradas: foo, bar/);
});

const previa = (u, extra) => u.agente.post('/api/importacao/previa').send(extra);
const contaDe = async u => (await u.agente.get('/api/contas')).body[0].id;

test('prévia de OFX: tipos, valores em reais, categoria sugerida e nada gravado', async () => {
  const u = await novoUsuario();
  const r = await previa(u, { conta_id: await contaDe(u), conteudo: OFX_SGML });
  assert.equal(r.status, 200);
  assert.equal(r.body.formato, 'ofx');
  assert.deepEqual(r.body.itens.map(i => [i.tipo, i.valor]), [['saida', 45.9], ['entrada', 5000], ['saida', 1234.56]]);
  assert.ok(r.body.itens.every(i => Number.isInteger(i.categoria_id) && i.duplicada === null));
  assert.equal((await u.agente.get('/api/transactions')).body.total, 0);
});

test('a categoria sugerida vem do que a pessoa já usou para a mesma descrição', async () => {
  const u = await novoUsuario();
  await u.agente.post('/api/transactions').send({ desc: 'Uber *Trip', valor: 20, tipo: 'saida', cat: 'Transporte', data: '2026-02-01' });
  const r = await previa(u, { conta_id: await contaDe(u), conteudo: OFX_XML });
  const transporte = await categoriaDe(u.agente, 'Transporte');
  const outros = await categoriaDe(u.agente, 'Outros');
  assert.equal(r.body.itens[0].categoria_id, transporte.id);
  assert.equal(r.body.itens[1].categoria_id, outros.id);
});

test('prévia de CSV sem id do banco gera ids estáveis e distingue compras idênticas', async () => {
  const u = await novoUsuario();
  const conteudo = 'Data;Descrição;Valor\n01/03/2026;Café;-8,00\n01/03/2026;Café;-8,00\n';
  const a = await previa(u, { conta_id: await contaDe(u), conteudo });
  const b = await previa(u, { conta_id: await contaDe(u), conteudo });
  assert.equal(a.body.itens.length, 2);
  assert.notEqual(a.body.itens[0].externo, a.body.itens[1].externo);
  assert.deepEqual(a.body.itens.map(i => i.externo), b.body.itens.map(i => i.externo));
});

test('confirmar grava, e confirmar de novo não duplica', async () => {
  const u = await novoUsuario();
  const conta_id = await contaDe(u);
  const { body } = await previa(u, { conta_id, conteudo: OFX_SGML });

  const c1 = await u.agente.post('/api/importacao/confirmar').send({ conta_id, itens: body.itens });
  assert.deepEqual(c1.body, { importados: 3, ignorados: 0 });
  const c2 = await u.agente.post('/api/importacao/confirmar').send({ conta_id, itens: body.itens });
  assert.deepEqual(c2.body, { importados: 0, ignorados: 3 });

  const lista = (await u.agente.get('/api/transactions')).body;
  assert.equal(lista.total, 3);
  assert.equal(lista.totais.saldo, 3719.54); // 5000 - 45,90 - 1234,56
});

test('depois de importar, a prévia do mesmo arquivo marca tudo como já importado', async () => {
  const u = await novoUsuario();
  const conta_id = await contaDe(u);
  const { body } = await previa(u, { conta_id, conteudo: OFX_SGML });
  await u.agente.post('/api/importacao/confirmar').send({ conta_id, itens: body.itens });
  const de_novo = await previa(u, { conta_id, conteudo: OFX_SGML });
  assert.ok(de_novo.body.itens.every(i => i.duplicada === 'importada'));
});

test('mesma data e valor já lançados à mão viram "provável duplicata"', async () => {
  const u = await novoUsuario();
  await u.agente.post('/api/transactions').send({ desc: 'Padaria', valor: 12, tipo: 'saida', cat: 'Alimentação', data: '2026-03-02' });
  const r = await previa(u, { conta_id: await contaDe(u), conteudo: OFX_XML });
  assert.deepEqual(r.body.itens.map(i => i.duplicada), [null, 'provavel']);
});

test('o mesmo id em contas diferentes não conflita', async () => {
  const u = await novoUsuario();
  const c1 = await contaDe(u);
  const c2 = (await u.agente.post('/api/contas').send({ nome: 'Cartão', tipo: 'corrente' })).body.id;
  for (const conta_id of [c1, c2]) {
    const { body } = await previa(u, { conta_id, conteudo: OFX_XML });
    assert.equal((await u.agente.post('/api/importacao/confirmar').send({ conta_id, itens: body.itens })).body.importados, 2);
  }
});

test('confirmar valida cada linha e a categoria do usuário', async () => {
  const u = await novoUsuario();
  const conta_id = await contaDe(u);
  const cat = (await categoriaDe(u.agente, 'Outros')).id;
  const ok = { externo: 'x', data: '2026-03-01', desc: 'a', valor: 1, tipo: 'saida', categoria_id: cat };
  const casos = [
    [{ desc: ' ' }, /descrição/], [{ valor: 0 }, /valor/], [{ tipo: 'z' }, /tipo/],
    [{ data: '2026-02-30' }, /data/], [{ categoria_id: 999999 }, /categoria/],
  ];
  for (const [extra, regex] of casos) {
    const r = await u.agente.post('/api/importacao/confirmar').send({ conta_id, itens: [{ ...ok, ...extra }] });
    assert.equal(r.status, 400);
    assert.match(r.body.error, regex);
  }
  assert.equal((await u.agente.post('/api/importacao/confirmar').send({ conta_id, itens: [] })).status, 400);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM transactions WHERE user_id = ?').get(u.id).n, 0, 'nada é gravado se uma linha for inválida');
});

test('não importa para conta nem com categoria de outro usuário', async () => {
  const a = await novoUsuario('Ana');
  const b = await novoUsuario('Bia');
  const { body } = await previa(a, { conta_id: await contaDe(a), conteudo: OFX_XML });
  const r1 = await b.agente.post('/api/importacao/confirmar').send({ conta_id: await contaDe(a), itens: body.itens });
  assert.equal(r1.status, 400);
  const r2 = await b.agente.post('/api/importacao/confirmar').send({ conta_id: await contaDe(b), itens: body.itens });
  assert.equal(r2.status, 400, 'categoria_id da Ana não vale para a Bia');
  assert.equal((await previa(b, { conta_id: await contaDe(a), conteudo: OFX_XML })).status, 400);
});

test('arquivo vazio, ilegível ou sem conta dão 400 com mensagem', async () => {
  const u = await novoUsuario();
  const conta_id = await contaDe(u);
  assert.match((await previa(u, { conta_id, conteudo: '   ' })).body.error, /vazio/);
  assert.match((await previa(u, { conta_id, conteudo: 'a;b\n1;2' })).body.error, /colunas/i);
  assert.match((await previa(u, { conta_id, conteudo: '<OFX></OFX>' })).body.error, /Nenhum lançamento/);
  assert.equal((await previa(u, { conteudo: OFX_XML })).status, 400);
});

test('aceita arquivos maiores que o limite geral de 100kb', async () => {
  const u = await novoUsuario();
  const linhas = Array.from({ length: 1500 }, (_, i) => `01/03/2026;Compra número ${i} em loja com nome longo para ocupar espaço;-${i + 1},00`);
  const conteudo = `Data;Descrição;Valor\n${linhas.join('\n')}`;
  assert.ok(conteudo.length > 100_000);
  const r = await previa(u, { conta_id: await contaDe(u), conteudo });
  assert.equal(r.status, 200);
  assert.equal(r.body.itens.length, 1500);
});

test('exige login', async () => {
  const { request, app } = require('./helpers');
  assert.equal((await request(app).post('/api/importacao/previa').send({})).status, 401);
});
