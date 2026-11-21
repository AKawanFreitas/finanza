const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

// O app decide se serve o front ao ser carregado, então este arquivo prepara um dist falso antes.
const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'finanza-dist-'));
fs.mkdirSync(path.join(dist, 'assets'));
fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>Finanza</title><div id="root"></div>');
fs.writeFileSync(path.join(dist, 'assets', 'app-abc123.js'), 'console.log(1)');
process.env.STATIC_DIR = dist;

const { request, app } = require('./helpers');

test('a raiz devolve o index.html sem cache', async () => {
  const r = await request(app).get('/');
  assert.equal(r.status, 200);
  assert.match(r.text, /id="root"/);
  assert.equal(r.headers['cache-control'], 'no-cache');
});

test('rotas do front (SPA) caem no index.html', async () => {
  const r = await request(app).get('/qualquer/rota/do/react');
  assert.equal(r.status, 200);
  assert.match(r.text, /id="root"/);
});

test('arquivos com hash em assets/ ficam em cache longo', async () => {
  const r = await request(app).get('/assets/app-abc123.js');
  assert.equal(r.status, 200);
  assert.match(r.headers['cache-control'], /immutable/);
});

test('a API continua respondendo JSON: 404 de rota inexistente não vira HTML', async () => {
  const r = await request(app).get('/api/nada');
  assert.equal(r.status, 404);
  assert.match(r.headers['content-type'], /json/);
  assert.equal((await request(app).get('/api/health')).body.ok, true);
});

test('cabeçalhos de segurança do helmet estão presentes', async () => {
  const r = await request(app).get('/');
  assert.ok(r.headers['content-security-policy']);
  assert.equal(r.headers['x-content-type-options'], 'nosniff');
  assert.equal(r.headers['x-powered-by'], undefined);
});
