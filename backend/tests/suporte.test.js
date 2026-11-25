const test = require('node:test');
const assert = require('node:assert/strict');
const { db, request, app, novoUsuario, virarAdmin } = require('./helpers');

// Um administrador logado e um cliente com uma categoria própria.
async function cenario() {
  const admin = await novoUsuario('Admin');
  virarAdmin(admin.id);
  const cliente = await novoUsuario('Cliente');
  await cliente.agente.post('/api/categorias').send({ nome: 'Só do cliente', cor: '#123456' });
  return { admin, cliente };
}
const abrir = (admin, cliente, motivo = 'Cliente não consegue importar o extrato') =>
  admin.agente.post('/api/suporte/chamados').send({ user_id: cliente.id, motivo });

test('abrir chamado: o administrador passa a ver a conta do cliente e a tela recebe os dados do contador', async () => {
  const { admin, cliente } = await cenario();
  const r = await abrir(admin, cliente);
  assert.equal(r.status, 201);

  const eu = (await admin.agente.get('/api/auth/eu')).body.user;
  assert.equal(eu.id, cliente.id, 'a sessão age como o cliente');
  assert.equal(eu.suporte.motivo, 'Cliente não consegue importar o extrato');
  assert.equal(eu.suporte.admin.nome, 'Admin');
  assert.equal(eu.suporte.ocioso_ms, 60000);
  assert.ok(Date.parse(eu.suporte.expira_em) > Date.now());

  const cats = (await admin.agente.get('/api/categorias')).body.map(c => c.nome);
  assert.ok(cats.includes('Só do cliente'), 'os dados são os do cliente');
});

test('só o administrador abre chamado, e com motivo', async () => {
  const { admin, cliente } = await cenario();
  const outro = await novoUsuario('Outro');
  assert.equal((await abrir(outro, cliente)).status, 403);
  assert.equal((await abrir(admin, cliente, 'ok')).status, 400, 'motivo curto demais');
  assert.equal((await abrir(admin, cliente, '')).status, 400);
  assert.equal((await abrir(admin, { id: 999999 })).status, 404);
  assert.equal((await abrir(admin, admin)).status, 400, 'não abre chamado em conta de administrador');
});

test('não abre chamado em conta suspensa nem duplicado', async () => {
  const { admin, cliente } = await cenario();
  db.prepare("UPDATE users SET status = 'suspenso' WHERE id = ?").run(cliente.id);
  assert.equal((await abrir(admin, cliente)).status, 400);
  db.prepare("UPDATE users SET status = 'ativo' WHERE id = ?").run(cliente.id);
  assert.equal((await abrir(admin, cliente)).status, 201);
  assert.equal((await abrir(admin, cliente)).status, 409, 'já está dentro de um chamado');
});

test('dentro do chamado, as áreas de administrador ficam fechadas', async () => {
  const { admin, cliente } = await cenario();
  await abrir(admin, cliente);
  assert.equal((await admin.agente.get('/api/admin/usuarios')).status, 403);
});

test('dentro do chamado não dá para mudar senha, e-mail, perfil, foto nem excluir a conta do cliente', async () => {
  const { admin, cliente } = await cenario();
  await abrir(admin, cliente);
  const senha = await admin.agente.post('/api/auth/senha').send({ atual: cliente.senha, nova: 'outra-senha-9' });
  assert.equal(senha.status, 403);
  assert.equal((await admin.agente.patch('/api/auth/perfil').send({ nome: 'X Y', email: 'x@y.com' })).status, 403);
  assert.equal((await admin.agente.patch('/api/auth/preferencias').send({ notificacoes_email: false })).status, 403);
  assert.equal((await admin.agente.put('/api/auth/foto').set('Content-Type', 'image/jpeg').send(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2]))).status, 403);
  assert.equal((await admin.agente.delete('/api/auth/foto')).status, 403);
  assert.equal((await admin.agente.delete('/api/auth/conta').send({ senha: cliente.senha })).status, 403);
  assert.ok(db.prepare('SELECT 1 FROM users WHERE id = ?').get(cliente.id), 'a conta continua existindo');
  // a senha do cliente segue valendo
  assert.equal((await request(app).post('/api/auth/login').send({ email: cliente.email, senha: cliente.senha })).status, 200);
});

test('o cliente vê o aviso enquanto o chamado está aberto e o histórico depois', async () => {
  const { admin, cliente } = await cenario();
  assert.equal((await cliente.agente.get('/api/suporte/aviso')).body.aviso, null);

  await abrir(admin, cliente);
  const aviso = (await cliente.agente.get('/api/suporte/aviso')).body.aviso;
  assert.equal(aviso.admin_nome, 'Admin');
  assert.equal(aviso.motivo, 'Cliente não consegue importar o extrato');

  // o administrador altera dados como o cliente
  const cat = (await admin.agente.post('/api/categorias').send({ nome: 'Criada pelo suporte', cor: '#abcdef' })).body;
  await admin.agente.put(`/api/categorias/${cat.id}`).send({ nome: 'Renomeada pelo suporte', cor: '#abcdef' });
  await admin.agente.get('/api/categorias'); // leitura não conta como alteração

  assert.equal((await admin.agente.post('/api/suporte/encerrar')).status, 200);
  assert.equal((await cliente.agente.get('/api/suporte/aviso')).body.aviso, null);

  const hist = (await cliente.agente.get('/api/suporte/historico')).body;
  assert.equal(hist.length, 1);
  assert.equal(hist[0].encerrado_por, 'admin');
  assert.equal(hist[0].admin_nome, 'Admin');
  assert.deepEqual(hist[0].alteracoes, [{ rotulo: 'Criou categoria', n: 1 }, { rotulo: 'Editou categoria', n: 1 }]);
  assert.ok(hist[0].duracao_s >= 0);
});

test('encerrar devolve a conta do administrador, que continua logado', async () => {
  const { admin, cliente } = await cenario();
  await abrir(admin, cliente);
  await admin.agente.post('/api/suporte/encerrar');
  const eu = (await admin.agente.get('/api/auth/eu')).body.user;
  assert.equal(eu.id, admin.id);
  assert.equal(eu.suporte, null);
  assert.equal((await admin.agente.get('/api/admin/usuarios')).status, 200);
});

test('sair durante o chamado encerra só o chamado', async () => {
  const { admin, cliente } = await cenario();
  await abrir(admin, cliente);
  const r = await admin.agente.post('/api/auth/logout');
  assert.equal(r.body.suporte_encerrado, true);
  assert.equal((await admin.agente.get('/api/auth/eu')).body.user.id, admin.id, 'a sessão do administrador segue valendo');
});

test('1 minuto sem atividade fecha o chamado e devolve a conta do administrador', async () => {
  const { admin, cliente } = await cenario();
  await abrir(admin, cliente);
  const antigo = new Date(Date.now() - 61_000).toISOString();
  db.prepare('UPDATE chamados_suporte SET ultima_atividade = ? WHERE user_id = ?').run(antigo, cliente.id);

  const eu = (await admin.agente.get('/api/auth/eu')).body.user;
  assert.equal(eu.id, admin.id);
  assert.equal(eu.suporte, null);
  const hist = (await cliente.agente.get('/api/suporte/historico')).body;
  assert.equal(hist[0].encerrado_por, 'tempo');
});

test('o aviso do cliente some sozinho quando o administrador some (fechou a aba)', async () => {
  const { admin, cliente } = await cenario();
  await abrir(admin, cliente);
  db.prepare('UPDATE chamados_suporte SET ultima_atividade = ? WHERE user_id = ?').run(new Date(Date.now() - 90_000).toISOString(), cliente.id);
  assert.equal((await cliente.agente.get('/api/suporte/aviso')).body.aviso, null);
});

test('renovar estende o prazo; alterar dados também conta como atividade', async () => {
  const { admin, cliente } = await cenario();
  await abrir(admin, cliente);
  const velho = new Date(Date.now() - 50_000).toISOString();
  db.prepare('UPDATE chamados_suporte SET ultima_atividade = ? WHERE user_id = ?').run(velho, cliente.id);

  const r = (await admin.agente.post('/api/suporte/renovar')).body;
  assert.equal(r.ativo, true);
  assert.ok(Date.parse(r.expira_em) - Date.now() > 55_000, 'voltou a ter perto de 1 minuto');

  db.prepare('UPDATE chamados_suporte SET ultima_atividade = ? WHERE user_id = ?').run(velho, cliente.id);
  await admin.agente.post('/api/categorias').send({ nome: 'Atividade', cor: '#111111' });
  const depois = db.prepare('SELECT ultima_atividade FROM chamados_suporte WHERE user_id = ?').get(cliente.id).ultima_atividade;
  assert.ok(Date.parse(depois) > Date.parse(velho) + 40_000);
});

test('renovar e encerrar fora de um chamado não fazem nada', async () => {
  const { admin } = await cenario();
  assert.equal((await admin.agente.post('/api/suporte/renovar')).body.ativo, false);
  assert.equal((await admin.agente.post('/api/suporte/encerrar')).status, 200);
});

test('cliente suspenso durante o chamado: o chamado fecha e o administrador volta à conta dele', async () => {
  const { admin, cliente } = await cenario();
  await abrir(admin, cliente);
  db.prepare("UPDATE users SET status = 'suspenso' WHERE id = ?").run(cliente.id);
  assert.equal((await admin.agente.get('/api/auth/eu')).body.user.id, admin.id);
});

test('excluir o cliente apaga o chamado e a sessão do administrador volta ao normal', async () => {
  const { admin, cliente } = await cenario();
  await abrir(admin, cliente);
  db.prepare('DELETE FROM users WHERE id = ?').run(cliente.id);
  assert.equal((await admin.agente.get('/api/auth/eu')).body.user.id, admin.id);
});

test('o bloqueio dos dados de acesso não é contornado com barra no fim, maiúsculas ou barras repetidas', async () => {
  const { admin, cliente } = await cenario();
  await abrir(admin, cliente);
  const tentativas = [
    () => admin.agente.patch('/api/auth/perfil/').send({ nome: 'Cliente', email: 'tomada1@teste.local' }),
    () => admin.agente.patch('/api/AUTH/Perfil').send({ nome: 'Cliente', email: 'tomada2@teste.local' }),
    () => admin.agente.patch('/api/auth//perfil').send({ nome: 'Cliente', email: 'tomada3@teste.local' }),
    () => admin.agente.patch('/api/auth/preferencias/').send({ notificacoes_email: false }),
    () => admin.agente.delete('/api/auth/foto/'),
    () => admin.agente.post('/api/auth/reenviar-verificacao/'),
  ];
  for (const t of tentativas) {
    const r = await t();
    assert.ok(r.status === 403 || r.status === 404, `esperava bloqueio, veio ${r.status}`);
  }
  const atual = db.prepare('SELECT email, notificacoes_email FROM users WHERE id = ?').get(cliente.id);
  assert.ok(!atual.email.startsWith('tomada'), 'o e-mail do cliente não muda');
  assert.equal(atual.notificacoes_email, 1);
});
