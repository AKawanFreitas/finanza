const test = require('node:test');
const assert = require('node:assert/strict');
const { novoUsuario } = require('./helpers');
const db = require('../db');

// Imagens mínimas, só com os bytes de abertura que cada formato exige.
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(40, 1)]);
const PNG  = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40, 2)]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([8, 0, 0, 0]), Buffer.from('WEBPVP8 '), Buffer.alloc(20, 3)]);

const enviar = (agente, corpo, tipo = 'image/jpeg') => agente.put('/api/auth/foto').set('Content-Type', tipo).send(corpo);

test('sem foto: a conta não tem foto_url e a rota devolve 404', async () => {
  const { agente } = await novoUsuario();
  const eu = await agente.get('/api/auth/eu');
  assert.equal(eu.body.user.foto_url, null);
  assert.equal((await agente.get('/api/auth/foto')).status, 404);
});

test('envia JPG, PNG e WebP, e a foto volta com o tipo certo', async () => {
  const { agente } = await novoUsuario();
  for (const [corpo, tipo] of [[JPEG, 'image/jpeg'], [PNG, 'image/png'], [WEBP, 'image/webp']]) {
    const res = await enviar(agente, corpo, tipo);
    assert.equal(res.status, 200);
    assert.match(res.body.user.foto_url, /^\/api\/auth\/foto\?v=\d+$/);
    const foto = await agente.get('/api/auth/foto').buffer(true).parse((r, cb) => { const p = []; r.on('data', d => p.push(d)); r.on('end', () => cb(null, Buffer.concat(p))); });
    assert.equal(foto.status, 200);
    assert.equal(foto.headers['content-type'], tipo);
    assert.deepEqual(foto.body, corpo);
  }
});

test('recusa arquivo que não é imagem, mesmo com cabeçalho de imagem', async () => {
  const { agente } = await novoUsuario();
  const res = await enviar(agente, Buffer.from('<svg onload=alert(1)></svg>'), 'image/png');
  assert.equal(res.status, 400);
  assert.equal((await enviar(agente, Buffer.alloc(0))).status, 400);
  assert.equal((await agente.get('/api/auth/eu')).body.user.foto_url, null);
});

test('recusa arquivo grande demais', async () => {
  const { agente } = await novoUsuario();
  const grande = Buffer.concat([JPEG, Buffer.alloc(250 * 1024)]);
  assert.equal((await enviar(agente, grande)).status, 413);
});

test('trocar a foto atualiza a versão e remover apaga tudo', async () => {
  const { agente, id } = await novoUsuario();
  await enviar(agente, JPEG);
  await enviar(agente, PNG);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM fotos_perfil WHERE user_id = ?').get(id).n, 1);

  const res = await agente.delete('/api/auth/foto');
  assert.equal(res.status, 200);
  assert.equal(res.body.user.foto_url, null);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM fotos_perfil WHERE user_id = ?').get(id).n, 0);
  assert.equal((await agente.get('/api/auth/foto')).status, 404);
});

test('cada conta vê só a própria foto e precisa estar logada', async () => {
  const a = await novoUsuario();
  const b = await novoUsuario();
  await enviar(a.agente, JPEG);
  assert.equal((await b.agente.get('/api/auth/foto')).status, 404);
  const request = require('supertest');
  const app = require('../app');
  assert.equal((await request(app).get('/api/auth/foto')).status, 401);
  assert.equal((await request(app).put('/api/auth/foto').set('Content-Type', 'image/jpeg').send(JPEG)).status, 401);
});

test('excluir a conta leva a foto junto', async () => {
  const { agente, id, senha } = await novoUsuario();
  await enviar(agente, JPEG);
  const res = await agente.delete('/api/auth/conta').send({ senha });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(db.prepare('SELECT COUNT(*) n FROM fotos_perfil WHERE user_id = ?').get(id).n, 0);
});
