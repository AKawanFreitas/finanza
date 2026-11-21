const test = require('node:test');
const assert = require('node:assert/strict');
const { db, request, app } = require('./helpers');
const { criarContasIniciais } = require('../lib/bootstrap');

const login = (email, senha) => request(app).post('/api/auth/login').send({ email, senha });
const unico = () => `${Math.random().toString(36).slice(2, 8)}@teste.com`;

test('sem variáveis, não cria nada', () => {
  assert.deepEqual(criarContasIniciais({}), { admin: null, demo: null });
});

test('cria o super admin: entra com a senha, é admin e já tem e-mail confirmado, categorias e conta', async () => {
  const email = unico();
  assert.deepEqual(criarContasIniciais({ BOOTSTRAP_ADMIN_EMAIL: email, BOOTSTRAP_ADMIN_SENHA: 'senha-de-teste-do-admin-1', BOOTSTRAP_ADMIN_NOME: 'Chefe' }).admin, 'criada');
  const r = await login(email, 'senha-de-teste-do-admin-1');
  assert.equal(r.status, 200);
  assert.equal(r.body.user.papel, 'superadmin');
  assert.equal(r.body.user.nome, 'Chefe');
  assert.equal(r.body.user.email_verificado, true);
  assert.equal(r.body.user.trocar_senha, false);
  const id = r.body.user.id;
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM categorias WHERE user_id = ?').get(id).n, 8);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM contas WHERE user_id = ?').get(id).n, 1);
});

test('a senha é guardada com hash, nunca em texto', () => {
  const email = unico();
  criarContasIniciais({ BOOTSTRAP_ADMIN_EMAIL: email, BOOTSTRAP_ADMIN_SENHA: 'senha-de-teste-do-admin-1' });
  const { senha_hash } = db.prepare('SELECT senha_hash FROM users WHERE email = ?').get(email);
  assert.ok(senha_hash.startsWith('scrypt$'));
  assert.ok(!senha_hash.includes('senha-de-teste-do-admin-1'));
});

test('é idempotente: reiniciar não recria, nem desfaz senha trocada, nem apaga dados', async () => {
  const email = unico();
  const env = { BOOTSTRAP_ADMIN_EMAIL: email, BOOTSTRAP_ADMIN_SENHA: 'senha-de-teste-do-admin-1' };
  criarContasIniciais(env);
  const agente = request.agent(app);
  await agente.post('/api/auth/login').send({ email, senha: 'senha-de-teste-do-admin-1' });
  await agente.post('/api/auth/senha').send({ atual: 'senha-de-teste-do-admin-1', nova: 'senha-nova-do-admin-1' });
  await agente.post('/api/transactions').send({ desc: 'Meu lançamento', valor: 1, tipo: 'saida', cat: 'Outros', data: '2026-03-01' });

  assert.equal(criarContasIniciais(env).admin, 'existente');
  assert.equal((await login(email, 'senha-de-teste-do-admin-1')).status, 401, 'a senha do .env não volta');
  assert.equal((await login(email, 'senha-nova-do-admin-1')).status, 200);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users WHERE email = ?').get(email).n, 1);
  assert.equal((await agente.get('/api/transactions')).body.total, 1, 'os dados da pessoa continuam lá');
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM transactions WHERE descricao = 'Meu lançamento'").get().n, 1);
});

test('não rebaixa nem altera um usuário que já existe com o mesmo e-mail', async () => {
  const email = unico();
  await request(app).post('/api/auth/registrar').send({ nome: 'Pessoa Real', email, senha: 'senha-da-pessoa-1' });
  assert.equal(criarContasIniciais({ BOOTSTRAP_ADMIN_EMAIL: email, BOOTSTRAP_ADMIN_SENHA: 'senha-de-teste-do-admin-1' }).admin, 'existente');
  const r = await login(email, 'senha-da-pessoa-1');
  assert.equal(r.body.user.papel, 'user', 'não virou admin por causa do bootstrap');
  assert.equal((await login(email, 'senha-de-teste-do-admin-1')).status, 401);
});

test('senha curta ou e-mail inválido são ignorados (e nada é criado)', () => {
  const email = unico();
  assert.equal(criarContasIniciais({ BOOTSTRAP_ADMIN_EMAIL: email, BOOTSTRAP_ADMIN_SENHA: '1234567' }).admin, 'ignorada');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users WHERE email = ?').get(email).n, 0);
  assert.equal(criarContasIniciais({ BOOTSTRAP_ADMIN_EMAIL: 'isso-nao-e-email', BOOTSTRAP_ADMIN_SENHA: 'senha-de-teste-do-admin-1' }).admin, 'ignorada');
  assert.equal(criarContasIniciais({ BOOTSTRAP_ADMIN_EMAIL: email }).admin, 'ignorada', 'e-mail sem senha');
});

test('e-mail do admin é normalizado (maiúsculas e espaços)', async () => {
  const email = unico();
  criarContasIniciais({ BOOTSTRAP_ADMIN_EMAIL: `  ${email.toUpperCase()} `, BOOTSTRAP_ADMIN_SENHA: 'senha-de-teste-do-admin-1' });
  assert.equal((await login(email, 'senha-de-teste-do-admin-1')).status, 200);
});

test('demo só é criada com BOOTSTRAP_DEMO=true', () => {
  assert.equal(criarContasIniciais({ BOOTSTRAP_DEMO: 'false' }).demo, null);
  assert.equal(criarContasIniciais({}).demo, null);
});

test('demo: cria o usuário com dados de exemplo, entra e vê lançamentos, recorrentes e resumo', async () => {
  const email = unico();
  assert.equal(criarContasIniciais({ BOOTSTRAP_DEMO: 'true', BOOTSTRAP_DEMO_EMAIL: email, BOOTSTRAP_DEMO_SENHA: 'demo1234' }).demo, 'criada');
  const agente = request.agent(app);
  const r = await agente.post('/api/auth/login').send({ email, senha: 'demo1234' });
  assert.equal(r.body.user.papel, 'user');
  assert.equal(r.body.user.email_verificado, true);
  assert.ok((await agente.get('/api/transactions')).body.total > 100);
  assert.equal((await agente.get('/api/recorrentes')).body.length, 7);
  assert.ok((await agente.get('/api/resumo')).body.historico.length === 6);
});

test('demo é idempotente: não recarrega nem duplica os dados ao reiniciar', async () => {
  const email = unico();
  const env = { BOOTSTRAP_DEMO: 'TRUE', BOOTSTRAP_DEMO_EMAIL: email };
  criarContasIniciais(env);
  const agente = request.agent(app);
  await agente.post('/api/auth/login').send({ email, senha: 'demo1234' });
  const antes = (await agente.get('/api/transactions')).body.total;
  await agente.post('/api/transactions').send({ desc: 'Minha compra', valor: 1, tipo: 'saida', cat: 'Outros', data: '2026-03-01' });
  assert.equal(criarContasIniciais(env).demo, 'existente');
  assert.equal((await agente.get('/api/transactions')).body.total, antes + 1, 'a compra da pessoa continua e nada foi duplicado');
});

test('admin e demo juntos: cada um com os seus dados (isolamento)', async () => {
  const admin = unico(), demo = unico();
  criarContasIniciais({ BOOTSTRAP_ADMIN_EMAIL: admin, BOOTSTRAP_ADMIN_SENHA: 'senha-de-teste-do-admin-1', BOOTSTRAP_DEMO: 'true', BOOTSTRAP_DEMO_EMAIL: demo });
  const a = request.agent(app); await a.post('/api/auth/login').send({ email: admin, senha: 'senha-de-teste-do-admin-1' });
  const d = request.agent(app); await d.post('/api/auth/login').send({ email: demo, senha: 'demo1234' });
  assert.equal((await a.get('/api/transactions')).body.total, 0);
  assert.ok((await d.get('/api/transactions')).body.total > 0);
  assert.equal((await a.get('/api/admin/metricas')).status, 200);
  assert.equal((await d.get('/api/admin/metricas')).status, 403);
});
