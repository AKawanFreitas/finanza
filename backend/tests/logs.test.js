const test = require('node:test');
const assert = require('node:assert/strict');
const { request, app, novoUsuario } = require('./helpers');

test('toda resposta traz um X-Request-Id; um id enviado pelo proxy é mantido', async () => {
  const a = await request(app).get('/api/health');
  assert.match(a.headers['x-request-id'], /^[0-9a-f-]{36}$/);
  const b = await request(app).get('/api/health').set('X-Request-Id', 'abc-123');
  assert.equal(b.headers['x-request-id'], 'abc-123');
});

test('id de requisição absurdo é cortado', async () => {
  const r = await request(app).get('/api/health').set('X-Request-Id', 'x'.repeat(500));
  assert.equal(r.headers['x-request-id'].length, 64);
});

test('erro interno não vaza detalhes e o servidor continua de pé', async () => {
  const u = await novoUsuario();
  const r = await u.agente.post('/api/transactions').set('Content-Type', 'application/json').send('{ruim');
  assert.equal(r.status, 400);
  assert.equal((await request(app).get('/api/health')).status, 200);
});
