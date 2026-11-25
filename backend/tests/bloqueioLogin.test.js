// Com TRUST_PROXY, o X-Forwarded-For define o IP: dá para simular a vítima e o atacante em máquinas diferentes.
process.env.TRUST_PROXY = '1';
const test = require('node:test');
const assert = require('node:assert/strict');
const { request, app, db, novoUsuario, ultimoEmail, tokenDoEmail } = require('./helpers');

const login = (email, senha, ip) =>
  request(app).post('/api/auth/login').set('X-Forwarded-For', ip).send({ email, senha });

test('erros de senha vindos de outro IP não travam o login do dono da conta', async () => {
  const vitima = await novoUsuario();
  for (let i = 0; i < 12; i++) await login(vitima.email, 'chute-errado', '198.51.100.9');
  assert.equal((await login(vitima.email, 'chute-errado', '198.51.100.9')).status, 429, 'o atacante fica bloqueado');
  assert.equal((await login(vitima.email, vitima.senha, '192.0.2.10')).status, 200, 'a vítima, de outro IP, entra');
});

test('ataque distribuído: muitos IPs no mesmo e-mail chegam ao teto por conta', async () => {
  const vitima = await novoUsuario();
  for (let i = 0; i < 50; i++) await login(vitima.email, 'chute-errado', `198.51.100.${i % 25}`);
  assert.equal((await login(vitima.email, 'chute-errado', '203.0.113.1')).status, 429);
});

test('redefinir a senha pelo e-mail libera o login bloqueado', async () => {
  const vitima = await novoUsuario();
  for (let i = 0; i < 50; i++) await login(vitima.email, 'chute-errado', `198.51.100.${i % 25}`);
  assert.equal((await login(vitima.email, vitima.senha, '192.0.2.10')).status, 429);

  await request(app).post('/api/auth/esqueci-senha').set('X-Forwarded-For', '192.0.2.10').send({ email: vitima.email });
  const token = tokenDoEmail(ultimoEmail(vitima.email), 'redefinir');
  assert.equal((await request(app).post('/api/auth/redefinir-senha').send({ token, nova: 'senha-nova-123' })).status, 200);
  assert.equal((await login(vitima.email, 'senha-nova-123', '192.0.2.10')).status, 200);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM limites WHERE chave LIKE ?").get(`login:${vitima.email}%`).n, 0);
});
