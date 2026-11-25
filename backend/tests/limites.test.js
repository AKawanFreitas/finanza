const test = require('node:test');
const assert = require('node:assert/strict');
const { request, app, db, novoUsuario } = require('./helpers');
const limite = require('../lib/limite');

const falhar = (email, ip = '10.0.0.1') =>
  request(app).post('/api/auth/login').set('X-Forwarded-For', ip).send({ email, senha: 'errada-errada' });

test('o contador fica no banco, não na memória', async () => {
  const u = await novoUsuario();
  await falhar(u.email);
  await falhar(u.email);
  const linha = db.prepare('SELECT n, ate FROM limites WHERE chave = ?').get(`login:${u.email}`);
  assert.equal(linha.n, 2);
  assert.ok(linha.ate > Date.now());
});

test('bloqueio sobrevive a "reiniciar": o estado vem só do banco', async () => {
  const u = await novoUsuario();
  for (let i = 0; i < 8; i++) await falhar(u.email);
  // Nenhum estado em memória: limpar o cache dos módulos e recarregar enxerga o mesmo bloqueio.
  for (const k of Object.keys(require.cache)) if (/[\\/]lib[\\/](limite|auth)\.js$/.test(k)) delete require.cache[k];
  const recarregado = require('../lib/limite');
  assert.ok(recarregado.minutosBloqueado(`login:${u.email}`, 8) >= 1);
  const r = await falhar(u.email);
  assert.equal(r.status, 429);
  assert.match(r.body.error, /min/);
});

test('a janela expira e libera de novo', async () => {
  const u = await novoUsuario();
  for (let i = 0; i < 8; i++) await falhar(u.email);
  assert.equal((await falhar(u.email)).status, 429);
  // Expira todas as chaves da conta (a do e-mail e a do par e-mail + IP).
  db.prepare("UPDATE limites SET ate = ? WHERE chave = ? OR chave LIKE ?").run(Date.now() - 1, `login:${u.email}`, `login:${u.email}|%`);
  assert.equal((await falhar(u.email)).status, 401, 'voltou a responder normalmente');
});

test('login certo zera o contador do e-mail', async () => {
  const u = await novoUsuario();
  for (let i = 0; i < 5; i++) await falhar(u.email);
  const ok = await request(app).post('/api/auth/login').send({ email: u.email, senha: u.senha });
  assert.equal(ok.status, 200);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM limites WHERE chave = ?').get(`login:${u.email}`).n, 0);
});

test('limite por IP: muitos e-mails diferentes do mesmo IP também são barrados', async () => {
  const ip = '203.0.113.7';
  db.prepare('DELETE FROM limites').run();
  let ultimo;
  for (let i = 0; i < 31; i++) ultimo = await request(app).post('/api/auth/login').set('X-Forwarded-For', ip).send({ email: `x${i}@teste.com`, senha: 'qualquer-coisa' });
  // sem TRUST_PROXY o IP é o da conexão (igual para todos): a 31ª tentativa cai no limite do IP
  assert.equal(ultimo.status, 429);
});

test('permitir(): conta eventos por janela e a chave é independente', () => {
  assert.equal(limite.permitir('t:a', 2, 60_000), true);
  assert.equal(limite.permitir('t:a', 2, 60_000), true);
  assert.equal(limite.permitir('t:a', 2, 60_000), false);
  assert.equal(limite.permitir('t:b', 2, 60_000), true);
});

test('limparExpirados remove só o que venceu', () => {
  db.prepare('DELETE FROM limites').run();
  db.prepare('INSERT INTO limites (chave, n, ate) VALUES (?, 1, ?), (?, 1, ?)').run('velho', Date.now() - 5000, 'novo', Date.now() + 60_000);
  assert.equal(limite.limparExpirados(), 1);
  assert.deepEqual(db.prepare('SELECT chave FROM limites').all().map(r => r.chave), ['novo']);
});

test('recuperação de senha continua limitada a 3 e-mails por endereço', async () => {
  const u = await novoUsuario();
  const { enviados } = require('./helpers');
  const antes = enviados.filter(e => e.para === u.email).length;
  for (let i = 0; i < 5; i++) await request(app).post('/api/auth/esqueci-senha').send({ email: u.email });
  assert.equal(enviados.filter(e => e.para === u.email).length - antes, 3);
});
