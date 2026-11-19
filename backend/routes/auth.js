const express = require('express');
const router  = express.Router();
const db      = require('../db');
const auth    = require('../lib/auth');

const EMAIL_RE  = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SENHA_MIN = 8;

const publico = u => ({
  id: u.id, nome: u.nome, email: u.email, papel: u.papel,
  trocar_senha: !!u.trocar_senha, criado_em: u.criado_em,
});

function validarNome(valor) {
  const nome = typeof valor === 'string' ? valor.trim().replace(/\s+/g, ' ') : '';
  if (nome.length < 2)  return { error: 'Informe seu nome.' };
  if (nome.length > 60) return { error: 'O nome deve ter até 60 caracteres.' };
  return { value: nome };
}

function validarEmail(valor) {
  const email = typeof valor === 'string' ? valor.trim().toLowerCase() : '';
  if (!EMAIL_RE.test(email)) return { error: 'Informe um e-mail válido.' };
  if (email.length > 120)    return { error: 'O e-mail deve ter até 120 caracteres.' };
  return { value: email };
}

function validarSenha(valor) {
  const senha = typeof valor === 'string' ? valor : '';
  if (senha.length < SENHA_MIN) return { error: `A senha deve ter pelo menos ${SENHA_MIN} caracteres.` };
  if (senha.length > 200)       return { error: 'A senha deve ter até 200 caracteres.' };
  return { value: senha };
}

function abrirSessao(res, userId) {
  const { token, expira } = auth.criarSessao(userId);
  auth.gravarCookie(res, token, expira);
  db.prepare('UPDATE users SET ultimo_acesso = ? WHERE id = ?').run(new Date().toISOString(), userId);
}

const buscarUser = id => db.prepare('SELECT * FROM users WHERE id = ?').get(id);

/* ── Criar conta ────────────────────────────────────── */
router.post('/registrar', (req, res) => {
  const nome  = validarNome(req.body?.nome);
  const email = validarEmail(req.body?.email);
  const senha = validarSenha(req.body?.senha);
  const erro  = nome.error || email.error || senha.error;
  if (erro) return res.status(400).json({ error: erro });

  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email.value)) {
    return res.status(409).json({ error: 'Já existe uma conta com esse e-mail.' });
  }

  const criar = db.transaction(() => {
    const { lastInsertRowid } = db.prepare(
      'INSERT INTO users (nome, email, senha_hash, papel, status, criado_em) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(nome.value, email.value, auth.hashSenha(senha.value), 'user', 'ativo', new Date().toISOString());
    const id = Number(lastInsertRowid);
    db.seedCategorias(id);
    return id;
  });

  const id = criar();
  abrirSessao(res, id);
  res.status(201).json({ user: publico(buscarUser(id)) });
});

/* ── Entrar ─────────────────────────────────────────── */
router.post('/login', (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const senha = typeof req.body?.senha === 'string' ? req.body.senha : '';
  if (!email || !senha) return res.status(400).json({ error: 'Informe o e-mail e a senha.' });

  const minutos = auth.bloqueado(email);
  if (minutos) return res.status(429).json({ error: `Muitas tentativas. Tente de novo em ${minutos} min.` });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  // Mesma mensagem para e-mail inexistente e senha errada: não revela quem tem conta.
  if (!user || !auth.conferirSenha(senha, user.senha_hash)) {
    auth.registrarFalha(email);
    return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
  }
  if (user.status !== 'ativo') {
    return res.status(403).json({ error: 'Esta conta está suspensa. Fale com o administrador.' });
  }

  auth.limparTentativas(email);
  auth.limparExpiradas();
  abrirSessao(res, user.id);
  res.json({ user: publico(user) });
});

/* ── Sair ───────────────────────────────────────────── */
router.post('/logout', (req, res) => {
  const user = auth.usuarioDaRequisicao(req);
  if (user) auth.encerrarSessao(user.token);
  auth.apagarCookie(res);
  res.json({ ok: true });
});

/* ── Quem está logado ───────────────────────────────── */
router.get('/eu', (req, res) => {
  const user = auth.usuarioDaRequisicao(req);
  res.json({ user: user ? publico(user) : null });
});

/* ── Editar perfil ──────────────────────────────────── */
router.patch('/perfil', auth.exigirLogin, (req, res) => {
  const nome  = validarNome(req.body?.nome);
  const email = validarEmail(req.body?.email);
  const erro  = nome.error || email.error;
  if (erro) return res.status(400).json({ error: erro });

  if (db.prepare('SELECT 1 FROM users WHERE email = ? AND id != ?').get(email.value, req.user.id)) {
    return res.status(409).json({ error: 'Já existe uma conta com esse e-mail.' });
  }

  db.prepare('UPDATE users SET nome = ?, email = ? WHERE id = ?').run(nome.value, email.value, req.user.id);
  res.json({ user: publico(buscarUser(req.user.id)) });
});

/* ── Trocar senha ───────────────────────────────────── */
router.post('/senha', (req, res) => {
  const user = auth.usuarioDaRequisicao(req);
  if (!user) return res.status(401).json({ error: 'Entre na sua conta para continuar.' });

  const nova = validarSenha(req.body?.nova);
  if (nova.error) return res.status(400).json({ error: nova.error });

  const { senha_hash } = db.prepare('SELECT senha_hash FROM users WHERE id = ?').get(user.id);
  if (!auth.conferirSenha(String(req.body?.atual || ''), senha_hash)) {
    return res.status(400).json({ error: 'A senha atual está incorreta.' });
  }
  if (auth.conferirSenha(nova.value, senha_hash)) {
    return res.status(400).json({ error: 'A nova senha deve ser diferente da atual.' });
  }

  // Trocar a senha derruba todas as sessões; logo abaixo abrimos uma nova para quem trocou.
  const trocar = db.transaction(() => {
    db.prepare('UPDATE users SET senha_hash = ?, trocar_senha = 0 WHERE id = ?')
      .run(auth.hashSenha(nova.value), user.id);
    auth.encerrarSessoesDe(user.id);
  });
  trocar();
  abrirSessao(res, user.id);
  res.json({ user: publico(buscarUser(user.id)) });
});

/* ── Excluir a própria conta ────────────────────────── */
router.delete('/conta', auth.exigirLogin, (req, res) => {
  const { senha_hash } = db.prepare('SELECT senha_hash FROM users WHERE id = ?').get(req.user.id);
  if (!auth.conferirSenha(String(req.body?.senha || ''), senha_hash)) {
    return res.status(400).json({ error: 'A senha está incorreta.' });
  }
  if (req.user.papel === 'superadmin') {
    return res.status(400).json({ error: 'A conta do administrador não pode ser excluída por aqui.' });
  }

  // ON DELETE CASCADE remove lançamentos, recorrentes, categorias e sessões.
  db.prepare('DELETE FROM users WHERE id = ?').run(req.user.id);
  auth.apagarCookie(res);
  res.json({ ok: true });
});

module.exports = router;
