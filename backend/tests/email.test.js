const test = require('node:test');
const assert = require('node:assert/strict');
const { request, app, db, novoUsuario, confirmarEmail, ultimoEmail, emailsPara, tokenDoEmail } = require('./helpers');
const { enviarResumosMensais } = require('../lib/resumoMensal');

const login = (email, senha) => request(app).post('/api/auth/login').send({ email, senha });
const pedirReset = email => request(app).post('/api/auth/esqueci-senha').send({ email });
const redefinir = (token, nova) => request(app).post('/api/auth/redefinir-senha').send({ token, nova });

/* ── Redefinir senha ─────────────────────────────── */

test('esqueci a senha: manda link e a nova senha passa a valer', async () => {
  const u = await novoUsuario();
  const r = await pedirReset(u.email);
  assert.equal(r.status, 200);
  const email = ultimoEmail(u.email);
  assert.match(email.assunto, /Redefinir/);
  assert.match(email.html, /redefinir=/);

  const token = tokenDoEmail(email, 'redefinir');
  assert.equal((await redefinir(token, 'senha-nova-123')).status, 200);
  assert.equal((await login(u.email, 'senha-nova-123')).status, 200);
  assert.equal((await login(u.email, u.senha)).status, 401, 'a senha antiga deixou de valer');
});

test('a resposta é igual para e-mail que existe e que não existe, e só o primeiro recebe e-mail', async () => {
  const u = await novoUsuario();
  const antes = emailsPara('fantasma@teste.com').length;
  const a = await pedirReset(u.email);
  const b = await pedirReset('fantasma@teste.com');
  assert.equal(a.status, b.status);
  assert.deepEqual(a.body, b.body);
  assert.equal(emailsPara('fantasma@teste.com').length, antes);
  assert.ok(emailsPara(u.email).some(e => /Redefinir/.test(e.assunto)));
});

test('o link só funciona uma vez', async () => {
  const u = await novoUsuario();
  await pedirReset(u.email);
  const token = tokenDoEmail(ultimoEmail(u.email), 'redefinir');
  assert.equal((await redefinir(token, 'senha-nova-123')).status, 200);
  assert.equal((await redefinir(token, 'outra-senha-456')).status, 400);
});

test('link expirado ou inventado é recusado', async () => {
  const u = await novoUsuario();
  await pedirReset(u.email);
  const token = tokenDoEmail(ultimoEmail(u.email), 'redefinir');
  db.prepare("UPDATE tokens SET expira_em = '2020-01-01T00:00:00.000Z' WHERE user_id = ?").run(u.id);
  assert.equal((await redefinir(token, 'senha-nova-123')).status, 400);
  assert.equal((await redefinir('x'.repeat(43), 'senha-nova-123')).status, 400);
  assert.equal((await redefinir(undefined, 'senha-nova-123')).status, 400);
});

test('o banco guarda só o hash do token', async () => {
  const u = await novoUsuario();
  await pedirReset(u.email);
  const token = tokenDoEmail(ultimoEmail(u.email), 'redefinir');
  const guardado = db.prepare("SELECT token_hash FROM tokens WHERE user_id = ? AND tipo = 'redefinir_senha'").get(u.id).token_hash;
  assert.notEqual(guardado, token);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM tokens WHERE token_hash = ?').get(token).n, 0);
});

test('um pedido novo invalida o link anterior', async () => {
  const u = await novoUsuario();
  await pedirReset(u.email);
  const antigo = tokenDoEmail(ultimoEmail(u.email), 'redefinir');
  await pedirReset(u.email);
  const novo = tokenDoEmail(ultimoEmail(u.email), 'redefinir');
  assert.notEqual(antigo, novo);
  assert.equal((await redefinir(antigo, 'senha-nova-123')).status, 400);
  assert.equal((await redefinir(novo, 'senha-nova-123')).status, 200);
});

test('senha fraca é recusada sem gastar o link', async () => {
  const u = await novoUsuario();
  await pedirReset(u.email);
  const token = tokenDoEmail(ultimoEmail(u.email), 'redefinir');
  assert.equal((await redefinir(token, '123')).status, 400);
  assert.equal((await redefinir(token, 'senha-nova-123')).status, 200);
});

test('redefinir derruba as sessões abertas e cancela a troca obrigatória', async () => {
  const u = await novoUsuario();
  db.prepare('UPDATE users SET trocar_senha = 1 WHERE id = ?').run(u.id);
  await pedirReset(u.email);
  await redefinir(tokenDoEmail(ultimoEmail(u.email), 'redefinir'), 'senha-nova-123');
  assert.equal((await u.agente.get('/api/transactions')).status, 401);
  const eu = await login(u.email, 'senha-nova-123');
  assert.equal(eu.body.user.trocar_senha, false);
});

test('conta suspensa não recebe o link', async () => {
  const u = await novoUsuario();
  db.prepare("UPDATE users SET status = 'suspenso' WHERE id = ?").run(u.id);
  const antes = emailsPara(u.email).length;
  assert.equal((await pedirReset(u.email)).status, 200);
  assert.equal(emailsPara(u.email).length, antes);
});

test('limite de pedidos por e-mail: o quarto não envia, mas a resposta continua igual', async () => {
  const u = await novoUsuario();
  const antes = emailsPara(u.email).length;
  const respostas = [];
  for (let i = 0; i < 5; i++) respostas.push((await pedirReset(u.email)).status);
  assert.deepEqual(respostas, [200, 200, 200, 200, 200]);
  assert.equal(emailsPara(u.email).length - antes, 3);
});

test('e-mail malformado dá 400', async () => {
  assert.equal((await pedirReset('isso-nao-e-email')).status, 400);
});

/* ── Verificação de e-mail ───────────────────────── */

test('cadastro manda e-mail de verificação; o link confirma o endereço', async () => {
  const u = await novoUsuario();
  assert.equal((await u.agente.get('/api/auth/eu')).body.user.email_verificado, false);
  const email = ultimoEmail(u.email);
  assert.match(email.assunto, /Confirme/);
  assert.equal((await request(app).post('/api/auth/verificar-email').send({ token: tokenDoEmail(email, 'verificar') })).status, 200);
  assert.equal((await u.agente.get('/api/auth/eu')).body.user.email_verificado, true);
});

test('o link de verificação não serve duas vezes nem como link de senha', async () => {
  const u = await novoUsuario();
  const token = tokenDoEmail(ultimoEmail(u.email), 'verificar');
  assert.equal((await redefinir(token, 'senha-nova-123')).status, 400, 'tipo errado');
  assert.equal((await request(app).post('/api/auth/verificar-email').send({ token })).status, 200);
  assert.equal((await request(app).post('/api/auth/verificar-email').send({ token })).status, 400);
});

test('reenviar verificação: manda novo link, invalida o antigo e tem limite', async () => {
  const u = await novoUsuario();
  const antigo = tokenDoEmail(ultimoEmail(u.email), 'verificar');
  assert.equal((await u.agente.post('/api/auth/reenviar-verificacao')).status, 200);
  const novo = tokenDoEmail(ultimoEmail(u.email), 'verificar');
  assert.notEqual(antigo, novo);
  assert.equal((await request(app).post('/api/auth/verificar-email').send({ token: antigo })).status, 400);
  await u.agente.post('/api/auth/reenviar-verificacao');
  await u.agente.post('/api/auth/reenviar-verificacao');
  assert.equal((await u.agente.post('/api/auth/reenviar-verificacao')).status, 429);
});

test('quem já confirmou não recebe outro e-mail', async () => {
  const u = await novoUsuario();
  confirmarEmail(u.id);
  const antes = emailsPara(u.email).length;
  const r = await u.agente.post('/api/auth/reenviar-verificacao');
  assert.equal(r.body.ja_verificado, true);
  assert.equal(emailsPara(u.email).length, antes);
});

test('trocar o e-mail do perfil volta a pedir confirmação, no endereço novo', async () => {
  const u = await novoUsuario();
  confirmarEmail(u.id);
  const novo = `novo-${u.email}`;
  const r = await u.agente.patch('/api/auth/perfil').send({ nome: 'Fulana', email: novo, senha: u.senha });
  assert.equal(r.body.user.email_verificado, false);
  assert.match(ultimoEmail(novo).assunto, /Confirme/);

  const mesmo = await u.agente.patch('/api/auth/perfil').send({ nome: 'Fulana Silva', email: novo });
  assert.equal(mesmo.status, 200);
  assert.equal(emailsPara(novo).length, 1, 'mudar só o nome não reenvia');
});

test('trocar o e-mail exige a senha atual e avisa o endereço antigo', async () => {
  const u = await novoUsuario();
  const novo = `trocado-${u.email}`;
  const semSenha = await u.agente.patch('/api/auth/perfil').send({ nome: 'Fulana', email: novo });
  assert.equal(semSenha.status, 400);
  assert.match(semSenha.body.error, /senha/i);
  const errada = await u.agente.patch('/api/auth/perfil').send({ nome: 'Fulana', email: novo, senha: 'nao-e-essa' });
  assert.equal(errada.status, 400);
  assert.equal(db.prepare('SELECT email FROM users WHERE id = ?').get(u.id).email, u.email, 'nada mudou');

  const ok = await u.agente.patch('/api/auth/perfil').send({ nome: 'Fulana', email: novo, senha: u.senha });
  assert.equal(ok.status, 200);
  const aviso = ultimoEmail(u.email);
  assert.match(aviso.assunto, /e-mail .*alterado/i);
  assert.ok(aviso.texto.includes(novo));

  const soNome = await u.agente.patch('/api/auth/perfil').send({ nome: 'Fulana Nova', email: novo });
  assert.equal(soNome.status, 200, 'mudar só o nome não pede senha');
});

test('redefinir a senha pelo e-mail também confirma o endereço', async () => {
  const u = await novoUsuario();
  await pedirReset(u.email);
  await redefinir(tokenDoEmail(ultimoEmail(u.email), 'redefinir'), 'senha-nova-123');
  const eu = await login(u.email, 'senha-nova-123');
  assert.equal(eu.body.user.email_verificado, true);
});

test('preferência de avisos por e-mail', async () => {
  const u = await novoUsuario();
  assert.equal((await u.agente.get('/api/auth/eu')).body.user.notificacoes_email, true);
  const r = await u.agente.patch('/api/auth/preferencias').send({ notificacoes_email: false });
  assert.equal(r.body.user.notificacoes_email, false);
  assert.equal((await u.agente.patch('/api/auth/preferencias').send({ notificacoes_email: 'não' })).status, 400);
});

/* ── Resumo mensal ───────────────────────────────── */

async function comMovimento({ verificado = true } = {}) {
  const u = await novoUsuario();
  if (verificado) confirmarEmail(u.id);
  await u.agente.post('/api/transactions').send({ desc: 'Salário', valor: 5000, tipo: 'entrada', cat: 'Renda', data: '2026-02-05' });
  await u.agente.post('/api/transactions').send({ desc: 'Mercado', valor: 800, tipo: 'saida', cat: 'Alimentação', data: '2026-02-10' });
  await u.agente.post('/api/transactions').send({ desc: 'Cinema', valor: 60, tipo: 'saida', cat: 'Lazer', data: '2026-02-12' });
  return u;
}

const resumos = u => emailsPara(u.email).filter(e => /resumo/i.test(e.assunto));

test('resumo mensal: manda o do mês anterior com os números certos', async () => {
  const u = await comMovimento();
  enviarResumosMensais(new Date('2026-03-02T12:00:00Z'));
  const [e] = resumos(u);
  assert.ok(e, 'recebeu o resumo');
  assert.match(e.assunto, /fevereiro de 2026/);
  assert.match(e.texto, /Receitas: R\$ 5\.000,00/);
  assert.match(e.texto, /Gastos: R\$ 860,00/);
  assert.match(e.texto, /Saldo do mês: R\$ 4\.140,00/);
  assert.match(e.texto, /Alimentação: R\$ 800,00/);
});

test('resumo mensal: uma vez por mês, mesmo com várias execuções', async () => {
  const u = await comMovimento();
  enviarResumosMensais(new Date('2026-03-01T12:00:00Z'));
  enviarResumosMensais(new Date('2026-03-01T18:00:00Z'));
  enviarResumosMensais(new Date('2026-03-03T12:00:00Z'));
  assert.equal(resumos(u).length, 1);
});

test('resumo mensal: não manda depois do dia 5, sem e-mail confirmado, com avisos desligados ou sem movimento', async () => {
  const tarde = await comMovimento();
  const naoConfirmou = await comMovimento({ verificado: false });
  const optOut = await comMovimento();
  await optOut.agente.patch('/api/auth/preferencias').send({ notificacoes_email: false });
  const vazio = await novoUsuario(); confirmarEmail(vazio.id);

  enviarResumosMensais(new Date('2026-03-20T12:00:00Z'));
  assert.equal(resumos(tarde).length, 0, 'fora da janela de 5 dias');

  enviarResumosMensais(new Date('2026-03-02T12:00:00Z'));
  assert.equal(resumos(naoConfirmou).length, 0);
  assert.equal(resumos(optOut).length, 0);
  assert.equal(resumos(vazio).length, 0);
  assert.equal(resumos(tarde).length, 1);
});

test('resumo mensal: nunca mistura dados de outra conta', async () => {
  const a = await comMovimento();
  const b = await novoUsuario(); confirmarEmail(b.id);
  await b.agente.post('/api/transactions').send({ desc: 'x', valor: 1, tipo: 'saida', cat: 'Lazer', data: '2026-02-01' });
  enviarResumosMensais(new Date('2026-03-02T12:00:00Z'));
  assert.match(resumos(b)[0].texto, /Gastos: R\$ 1,00/);
  assert.doesNotMatch(resumos(b)[0].texto, /860/);
  assert.match(resumos(a)[0].texto, /860,00/);
});

test('nome com HTML é escapado no e-mail', async () => {
  const u = await comMovimento();
  db.prepare('UPDATE users SET nome = ? WHERE id = ?').run('<script>alert(1)</script> Ana', u.id);
  enviarResumosMensais(new Date('2026-03-02T12:00:00Z'));
  const e = resumos(u)[0];
  assert.doesNotMatch(e.html, /<script>/);
});
