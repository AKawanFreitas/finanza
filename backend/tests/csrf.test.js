const test = require('node:test');
const assert = require('node:assert/strict');

process.env.APP_URL = 'https://app.exemplo.com.br';
process.env.CORS_ORIGIN = 'https://admin.exemplo.com.br, http://localhost:5173';

const { request, app, novoUsuario } = require('./helpers');

const lancamento = { desc: 'x', valor: 1, tipo: 'saida', cat: 'Outros', data: '2026-03-01' };

test('origem de outro site é barrada em POST, PUT, PATCH e DELETE', async () => {
  const u = await novoUsuario();
  const evil = { Origin: 'https://site-malicioso.com' };
  const r1 = await u.agente.post('/api/transactions').set(evil).send(lancamento);
  assert.equal(r1.status, 403);
  assert.match(r1.body.error, /Origem/);
  assert.equal((await u.agente.put('/api/transactions/1').set(evil).send(lancamento)).status, 403);
  assert.equal((await u.agente.patch('/api/auth/preferencias').set(evil).send({ notificacoes_email: false })).status, 403);
  assert.equal((await u.agente.delete('/api/transactions/1').set(evil)).status, 403);
  assert.equal((await u.agente.get('/api/transactions')).body.total, 0, 'nada foi gravado');
});

test('inclui login, cadastro e a rota de importação (que tem parser próprio)', async () => {
  const evil = { Origin: 'https://site-malicioso.com' };
  assert.equal((await request(app).post('/api/auth/login').set(evil).send({ email: 'a@b.com', senha: 'x' })).status, 403);
  assert.equal((await request(app).post('/api/auth/registrar').set(evil).send({})).status, 403);
  assert.equal((await request(app).post('/api/importacao/previa').set(evil).send({})).status, 403);
});

test('Origin "null" (iframe sandbox, arquivo local) é barrado', async () => {
  const u = await novoUsuario();
  assert.equal((await u.agente.post('/api/transactions').set({ Origin: 'null' }).send(lancamento)).status, 403);
});

test('mesma origem (mesmo host) passa, inclusive atrás do proxy do Vite', async () => {
  const u = await novoUsuario();
  const r = await u.agente.post('/api/transactions').set({ Host: 'localhost:5173', Origin: 'http://localhost:5173' }).send(lancamento);
  assert.equal(r.status, 201);
});

test('APP_URL e CORS_ORIGIN são origens permitidas', async () => {
  const u = await novoUsuario();
  for (const origin of ['https://app.exemplo.com.br', 'https://admin.exemplo.com.br', 'http://localhost:5173']) {
    assert.equal((await u.agente.post('/api/transactions').set({ Origin: origin }).send(lancamento)).status, 201, origin);
  }
});

test('um host parecido não engana (sufixo e subdomínio)', async () => {
  const u = await novoUsuario();
  for (const origin of ['https://app.exemplo.com.br.evil.com', 'https://evil-app.exemplo.com.br', 'https://exemplo.com.br']) {
    assert.equal((await u.agente.post('/api/transactions').set({ Origin: origin }).send(lancamento)).status, 403, origin);
  }
});

test('sem Origin (curl, servidor a servidor) passa; navegador cross-site sem Origin não', async () => {
  const u = await novoUsuario();
  assert.equal((await u.agente.post('/api/transactions').send(lancamento)).status, 201);
  assert.equal((await u.agente.post('/api/transactions').set({ 'Sec-Fetch-Site': 'cross-site' }).send(lancamento)).status, 403);
  assert.equal((await u.agente.post('/api/transactions').set({ 'Sec-Fetch-Site': 'same-origin' }).send(lancamento)).status, 201);
});

test('leituras não são afetadas pela checagem', async () => {
  const u = await novoUsuario();
  assert.equal((await u.agente.get('/api/transactions').set({ Origin: 'https://site-malicioso.com' })).status, 200);
});
