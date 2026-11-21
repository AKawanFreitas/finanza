// Regressão: em desenvolvimento o navegador fala com o Vite (localhost:5173), que repassa /api para a API.
// A proteção CSRF compara o Origin do navegador com o Host que a API recebe. O formato curto do proxy do Vite
// ('/api': 'http://...') usa changeOrigin: true e troca o Host pelo da API, o que derruba todo POST/PUT/DELETE
// com 403. Por isso a config precisa manter changeOrigin: false. (Um teste anterior passou por engano porque
// APP_URL estava definido; este roda sem ele de propósito.)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { request, app } = require('./helpers');

delete process.env.APP_URL;
delete process.env.CORS_ORIGIN;

const login = hdrs => request(app).post('/api/auth/login').set(hdrs).send({ email: 'x@y.com', senha: 'qualquer-coisa' });

test('o proxy do Vite preserva o Host (changeOrigin: false, em formato objeto)', () => {
  const cfg = fs.readFileSync(path.join(__dirname, '..', '..', 'vite.config.js'), 'utf8');
  assert.match(cfg, /changeOrigin:\s*false/);
  assert.doesNotMatch(cfg, /'\/api'\s*:\s*[`'"]/, "o formato curto ('/api': 'http://...') liga changeOrigin sozinho");
});

test('com o Host preservado pelo proxy, o login do navegador passa pela checagem (sem APP_URL)', async () => {
  const r = await login({ Host: 'localhost:5173', Origin: 'http://localhost:5173' });
  assert.equal(r.status, 401, 'chegou na lógica de login (credencial falsa), não foi barrado');
});

test('se o Host fosse trocado pelo da API, a mesma requisição seria barrada (o que o proxy não pode fazer)', async () => {
  const r = await login({ Host: 'localhost:4747', Origin: 'http://localhost:5173' });
  assert.equal(r.status, 403);
});
