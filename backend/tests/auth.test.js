const test = require('node:test');
const assert = require('node:assert/strict');
const { request, app, db, novoUsuario } = require('./helpers');

test('registrar cria sessão, categorias padrão e não vaza o hash', async () => {
  const u = await novoUsuario();
  const eu = await u.agente.get('/api/auth/eu');
  assert.equal(eu.body.user.email, u.email);
  assert.equal(eu.body.user.senha_hash, undefined);
  const cats = await u.agente.get('/api/categorias');
  assert.equal(cats.body.length, 8);
});

test('rotas financeiras exigem login', async () => {
  for (const rota of ['transactions', 'recorrentes', 'categorias']) {
    assert.equal((await request(app).get(`/api/${rota}`)).status, 401, rota);
  }
});

test('e-mail repetido (ignorando maiúsculas) é recusado', async () => {
  const u = await novoUsuario();
  const r = await request(app).post('/api/auth/registrar').send({ nome: 'Outra', email: u.email.toUpperCase(), senha: 'outra-senha-1' });
  assert.equal(r.status, 409);
});

test('senha curta é recusada', async () => {
  const r = await request(app).post('/api/auth/registrar').send({ nome: 'Ana', email: 'curta@teste.com', senha: '123' });
  assert.equal(r.status, 400);
});

test('login com senha errada e e-mail inexistente dão a mesma resposta', async () => {
  const u = await novoUsuario();
  const errada = await request(app).post('/api/auth/login').send({ email: u.email, senha: 'errada-errada' });
  const inexistente = await request(app).post('/api/auth/login').send({ email: 'nao@existe.com', senha: 'qualquer-senha' });
  assert.equal(errada.status, 401);
  assert.deepEqual(errada.body, inexistente.body);
});

test('e-mail inexistente leva o mesmo tempo que senha errada (o tempo não revela quem tem conta)', async () => {
  const u = await novoUsuario();
  const medir = async email => {
    const t = process.hrtime.bigint();
    await request(app).post('/api/auth/login').send({ email, senha: 'errada-errada' });
    return Number(process.hrtime.bigint() - t) / 1e6;
  };
  let errada = 0, inexistente = 0;
  for (let i = 0; i < 3; i++) { errada += await medir(u.email); inexistente += await medir(`fantasma${i}@teste.com`); }
  // Sem a conferência de mentira, o e-mail inexistente responde em ~1 ms contra ~25 ms do scrypt.
  assert.ok(inexistente > errada * 0.5, `inexistente ${inexistente.toFixed(1)} ms x errada ${errada.toFixed(1)} ms`);
});

test('logout encerra a sessão', async () => {
  const u = await novoUsuario();
  await u.agente.post('/api/auth/logout');
  assert.equal((await u.agente.get('/api/transactions')).status, 401);
});

test('conta suspensa não entra e perde a sessão aberta', async () => {
  const u = await novoUsuario();
  db.prepare("UPDATE users SET status = 'suspenso' WHERE id = ?").run(u.id);
  assert.equal((await u.agente.get('/api/transactions')).status, 401);
  const login = await request(app).post('/api/auth/login').send({ email: u.email, senha: u.senha });
  assert.equal(login.status, 403);
});

test('muitas tentativas erradas bloqueiam o login', async () => {
  const u = await novoUsuario();
  let ultimo;
  for (let i = 0; i < 9; i++) {
    ultimo = await request(app).post('/api/auth/login').send({ email: u.email, senha: 'errada-errada' });
  }
  assert.equal(ultimo.status, 429);
});

test('trocar a senha derruba as outras sessões', async () => {
  const u = await novoUsuario();
  const outro = request.agent(app);
  await outro.post('/api/auth/login').send({ email: u.email, senha: u.senha });
  const r = await u.agente.post('/api/auth/senha').send({ atual: u.senha, nova: 'nova-senha-123' });
  assert.equal(r.status, 200);
  assert.equal((await outro.get('/api/transactions')).status, 401);
  assert.equal((await u.agente.get('/api/transactions')).status, 200);
});

test('área de admin é negada a usuário comum', async () => {
  const u = await novoUsuario();
  assert.equal((await u.agente.get('/api/admin/usuarios')).status, 403);
  assert.equal((await u.agente.get('/api/admin/metricas')).status, 403);
});

test('excluir a conta apaga todos os dados dela', async () => {
  const u = await novoUsuario();
  const cat = (await u.agente.get('/api/categorias')).body[0];
  await u.agente.post('/api/transactions').send({ desc: 'x', valor: 10, tipo: 'saida', categoria_id: cat.id, data: '2026-01-01' });
  const r = await u.agente.delete('/api/auth/conta').send({ senha: u.senha });
  assert.equal(r.status, 200);
  for (const t of ['transactions', 'categorias', 'sessions']) {
    assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE user_id = ?`).get(u.id).n, 0, t);
  }
});
