const express = require('express');
const router  = express.Router();
const db      = require('../db');
const auth    = require('../lib/auth');
const tokens  = require('../lib/tokens');
const templates = require('../lib/templates');
const { enviarEmail } = require('../lib/email');
const { permitir }    = require('../lib/limite');
const logger  = require('../lib/logger');
const suporte = require('../lib/suporte');

const EMAIL_RE  = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SENHA_MIN = 8;

const publico = u => ({
  id: u.id, nome: u.nome, email: u.email, papel: u.papel,
  trocar_senha: !!u.trocar_senha, criado_em: u.criado_em,
  email_verificado: !!u.email_verificado_em, notificacoes_email: !!u.notificacoes_email,
  // O ?v= muda a cada troca, então o navegador não mostra uma foto antiga do cache.
  foto_url: u.foto_em ? `/api/auth/foto?v=${Date.parse(u.foto_em)}` : null,
  // Preenchido quando o administrador está dentro desta conta por um chamado de suporte.
  suporte: u.suporte ? suporte.descrever(u) : null,
});

// E-mails são disparados sem esperar: a resposta da API não depende do provedor de e-mail.
const semEsperar = (promessa, rotulo) => promessa.catch(err => logger.error({ err, rotulo }, 'falha ao enviar e-mail'));

function enviarVerificacao(user) {
  const { token } = tokens.criarToken(user.id, 'verificar_email');
  semEsperar(enviarEmail({ para: user.email, ...templates.verificarEmail({ nome: user.nome, token }) }), 'verificação');
}

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

// Dados de acesso (e-mail, senha, perfil, foto, a própria conta) nunca mudam numa sessão de suporte.
// A checagem fica na rota, e não só na lista de caminhos de lib/auth, para não depender de como o endereço foi escrito.
function semSuporte(req, res, next) {
  if (req.user?.suporte) return res.status(403).json({ error: suporte.MENSAGEM_BLOQUEIO });
  next();
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
    db.seedContas(id);
    return id;
  });

  const id = criar();
  abrirSessao(res, id);
  enviarVerificacao(buscarUser(id));
  res.status(201).json({ user: publico(buscarUser(id)) });
});

/* ── Entrar ─────────────────────────────────────────── */
router.post('/login', (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const senha = typeof req.body?.senha === 'string' ? req.body.senha : '';
  if (!email || !senha) return res.status(400).json({ error: 'Informe o e-mail e a senha.' });

  const minutos = auth.bloqueado(email, req.ip);
  if (minutos) return res.status(429).json({ error: `Muitas tentativas. Tente de novo em ${minutos} min.` });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  // Mesma mensagem para e-mail inexistente e senha errada: não revela quem tem conta.
  if (!user || !auth.conferirSenha(senha, user.senha_hash)) {
    auth.registrarFalha(email, req.ip);
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
  // Sair durante um chamado só encerra o chamado: o administrador continua logado na conta dele.
  if (user?.suporte) {
    suporte.encerrar(user.suporte.chamado.id, 'admin');
    return res.json({ ok: true, suporte_encerrado: true });
  }
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
router.patch('/perfil', auth.exigirLogin, semSuporte, (req, res) => {
  const nome  = validarNome(req.body?.nome);
  const email = validarEmail(req.body?.email);
  const erro  = nome.error || email.error;
  if (erro) return res.status(400).json({ error: erro });

  if (db.prepare('SELECT 1 FROM users WHERE email = ? AND id != ?').get(email.value, req.user.id)) {
    return res.status(409).json({ error: 'Já existe uma conta com esse e-mail.' });
  }

  // Trocar de e-mail exige confirmar o novo endereço.
  const mudouEmail = email.value !== req.user.email.toLowerCase();
  db.prepare('UPDATE users SET nome = ?, email = ?, email_verificado_em = CASE WHEN ? THEN NULL ELSE email_verificado_em END WHERE id = ?')
    .run(nome.value, email.value, mudouEmail ? 1 : 0, req.user.id);
  if (mudouEmail) enviarVerificacao(buscarUser(req.user.id));
  res.json({ user: publico(buscarUser(req.user.id)) });
});

/* ── Foto de perfil ─────────────────────────────────── */
// Confere o conteúdo do arquivo, não só o cabeçalho que o cliente mandou.
function tipoDaImagem(b) {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (b.length > 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

router.put('/foto', auth.exigirLogin, semSuporte, (req, res) => {
  const corpo = req.body;
  if (!Buffer.isBuffer(corpo) || corpo.length === 0) return res.status(400).json({ error: 'Envie uma imagem JPG, PNG ou WebP.' });
  const tipo = tipoDaImagem(corpo);
  if (!tipo) return res.status(400).json({ error: 'Envie uma imagem JPG, PNG ou WebP.' });

  db.transaction(() => {
    db.prepare('INSERT INTO fotos_perfil (user_id, tipo, dados) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET tipo = excluded.tipo, dados = excluded.dados')
      .run(req.user.id, tipo, corpo);
    db.prepare('UPDATE users SET foto_em = ? WHERE id = ?').run(new Date().toISOString(), req.user.id);
  })();
  res.json({ user: publico(buscarUser(req.user.id)) });
});

router.delete('/foto', auth.exigirLogin, semSuporte, (req, res) => {
  db.transaction(() => {
    db.prepare('DELETE FROM fotos_perfil WHERE user_id = ?').run(req.user.id);
    db.prepare('UPDATE users SET foto_em = NULL WHERE id = ?').run(req.user.id);
  })();
  res.json({ user: publico(buscarUser(req.user.id)) });
});

// Cada pessoa só vê a própria foto.
router.get('/foto', auth.exigirLogin, (req, res) => {
  const foto = db.prepare('SELECT tipo, dados FROM fotos_perfil WHERE user_id = ?').get(req.user.id);
  if (!foto) return res.status(404).json({ error: 'Sem foto.' });
  res.setHeader('Content-Type', foto.tipo);
  res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
  res.send(foto.dados);
});

/* ── Preferências de e-mail ─────────────────────────── */
router.patch('/preferencias', auth.exigirLogin, semSuporte, (req, res) => {
  const valor = req.body?.notificacoes_email;
  if (typeof valor !== 'boolean') return res.status(400).json({ error: 'Valor inválido.' });
  db.prepare('UPDATE users SET notificacoes_email = ? WHERE id = ?').run(valor ? 1 : 0, req.user.id);
  res.json({ user: publico(buscarUser(req.user.id)) });
});

/* ── Verificação de e-mail ──────────────────────────── */
router.post('/verificar-email', (req, res) => {
  const t = tokens.buscarToken(req.body?.token, 'verificar_email');
  if (!t) return res.status(400).json({ error: 'Este link é inválido ou expirou. Peça um novo nas configurações.' });

  db.transaction(() => {
    db.prepare('UPDATE users SET email_verificado_em = ? WHERE id = ?').run(new Date().toISOString(), t.user_id);
    tokens.consumirToken(t.id);
  })();
  res.json({ ok: true });
});

router.post('/reenviar-verificacao', auth.exigirLogin, semSuporte, (req, res) => {
  if (req.user.email_verificado_em) return res.json({ ok: true, ja_verificado: true });
  if (!permitir(`reenviar:${req.user.id}`, 3, 60 * 60e3)) {
    return res.status(429).json({ error: 'Você já pediu vários e-mails. Tente de novo em uma hora.' });
  }
  enviarVerificacao(buscarUser(req.user.id));
  res.json({ ok: true });
});

/* ── Recuperar senha ────────────────────────────────── */
const MSG_ESQUECI = 'Se existir uma conta com esse e-mail, enviamos um link para redefinir a senha.';

router.post('/esqueci-senha', (req, res) => {
  const email = validarEmail(req.body?.email);
  if (email.error) return res.status(400).json({ error: email.error });

  // A resposta é sempre a mesma, exista a conta ou não (e mesmo se o limite for atingido).
  const resposta = { ok: true, mensagem: MSG_ESQUECI };
  if (!permitir(`esqueci:${email.value}`, 3, 15 * 60e3) || !permitir(`esqueci-ip:${req.ip}`, 20, 15 * 60e3)) {
    return res.json(resposta);
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.value);
  if (user && user.status === 'ativo') {
    const { token, validadeMin } = tokens.criarToken(user.id, 'redefinir_senha');
    semEsperar(enviarEmail({ para: user.email, ...templates.redefinirSenha({ nome: user.nome, token, validadeMin }) }), 'redefinição de senha');
  }
  res.json(resposta);
});

router.post('/redefinir-senha', (req, res) => {
  const invalido = { error: 'Este link é inválido ou expirou. Peça um novo.' };
  const t = tokens.buscarToken(req.body?.token, 'redefinir_senha');
  if (!t) return res.status(400).json(invalido);
  const user = buscarUser(t.user_id);
  if (!user || user.status !== 'ativo') return res.status(400).json(invalido);

  const nova = validarSenha(req.body?.nova);
  if (nova.error) return res.status(400).json({ error: nova.error });

  db.transaction(() => {
    // Abrir o link enviado ao e-mail também prova que o endereço é da pessoa.
    db.prepare('UPDATE users SET senha_hash = ?, trocar_senha = 0, email_verificado_em = COALESCE(email_verificado_em, ?) WHERE id = ?')
      .run(auth.hashSenha(nova.value), new Date().toISOString(), user.id);
    tokens.consumirToken(t.id);
    auth.encerrarSessoesDe(user.id);
  })();
  res.json({ ok: true });
});

/* ── Trocar senha ───────────────────────────────────── */
router.post('/senha', (req, res) => {
  const user = auth.usuarioDaRequisicao(req);
  if (!user) return res.status(401).json({ error: 'Entre na sua conta para continuar.' });
  if (user.suporte) return res.status(403).json({ error: suporte.MENSAGEM_BLOQUEIO });

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
router.delete('/conta', auth.exigirLogin, semSuporte, (req, res) => {
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
