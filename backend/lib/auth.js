const crypto = require('crypto');
const db = require('../db');

const COOKIE       = 'finanza_sess';
const SESSION_DIAS = 30;
const SCRYPT       = { N: 16384, r: 8, p: 1 };
const KEYLEN       = 64;

/* ── Senhas ─────────────────────────────────────────── */

// Formato guardado: scrypt$<salt hex>$<hash hex>. A senha em texto nunca é gravada.
function hashSenha(senha) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(senha, salt, KEYLEN, SCRYPT);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function conferirSenha(senha, guardado) {
  const [alg, saltHex, hashHex] = String(guardado || '').split('$');
  if (alg !== 'scrypt' || !saltHex || !hashHex) return false;
  const esperado = Buffer.from(hashHex, 'hex');
  const obtido   = crypto.scryptSync(senha, Buffer.from(saltHex, 'hex'), esperado.length, SCRYPT);
  return crypto.timingSafeEqual(esperado, obtido);
}

// Sem caracteres ambíguos (0/O, 1/l), para poder ser ditada.
function senhaProvisoria() {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  return Array.from(crypto.randomBytes(12), b => alfabeto[b % alfabeto.length]).join('');
}

/* ── Sessões ────────────────────────────────────────── */

const hashToken = token => crypto.createHash('sha256').update(token).digest('hex');

function criarSessao(userId) {
  const token  = crypto.randomBytes(32).toString('base64url');
  const agora  = new Date();
  const expira = new Date(agora.getTime() + SESSION_DIAS * 864e5);
  db.prepare('INSERT INTO sessions (token_hash, user_id, criado_em, expira_em) VALUES (?, ?, ?, ?)')
    .run(hashToken(token), userId, agora.toISOString(), expira.toISOString());
  return { token, expira };
}

const encerrarSessao    = token  => db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
const encerrarSessoesDe = userId => db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
const limparExpiradas   = ()     => db.prepare('DELETE FROM sessions WHERE expira_em < ?').run(new Date().toISOString());

/* ── Cookie ─────────────────────────────────────────── */

function lerCookie(req) {
  const bruto = req.headers.cookie;
  if (!bruto) return null;
  for (const parte of bruto.split(';')) {
    const [nome, ...resto] = parte.trim().split('=');
    if (nome === COOKIE) return decodeURIComponent(resto.join('='));
  }
  return null;
}

// Cookie Secure em produção (exige HTTPS). Para rodar o build de produção em http://localhost
// (ex.: docker compose local), COOKIE_SECURE=false desliga.
const seguro = () => (process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : process.env.NODE_ENV === 'production');

function gravarCookie(res, token, expira) {
  const partes = [
    `${COOKIE}=${encodeURIComponent(token)}`,
    'Path=/', 'HttpOnly', 'SameSite=Lax',
    `Expires=${expira.toUTCString()}`,
  ];
  if (seguro()) partes.push('Secure');
  res.setHeader('Set-Cookie', partes.join('; '));
}

function apagarCookie(res) {
  const partes = [`${COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (seguro()) partes.push('Secure');
  res.setHeader('Set-Cookie', partes.join('; '));
}

/* ── Usuário da requisição ──────────────────────────── */

const SELECT_USER = `
  SELECT u.id, u.nome, u.email, u.papel, u.status, u.trocar_senha, u.criado_em, u.ultimo_acesso,
         u.email_verificado_em, u.notificacoes_email
  FROM sessions s JOIN users u ON u.id = s.user_id
  WHERE s.token_hash = ? AND s.expira_em > ?
`;

function usuarioDaRequisicao(req) {
  const token = lerCookie(req);
  if (!token) return null;
  const user = db.prepare(SELECT_USER).get(hashToken(token), new Date().toISOString());
  if (!user || user.status !== 'ativo') return null;
  return { ...user, trocar_senha: !!user.trocar_senha, token };
}

// Exige sessão válida. Com a senha marcada para troca, só libera o que é preciso para trocá-la.
function exigirLogin(req, res, next) {
  const user = usuarioDaRequisicao(req);
  if (!user) return res.status(401).json({ error: 'Entre na sua conta para continuar.' });

  const liberado = req.method === 'GET' || req.path === '/senha' || req.path === '/logout';
  if (user.trocar_senha && !liberado) {
    return res.status(403).json({ error: 'Defina uma nova senha para continuar.', trocar_senha: true });
  }

  req.user = user;
  next();
}

function exigirAdmin(req, res, next) {
  if (req.user?.papel !== 'superadmin') {
    return res.status(403).json({ error: 'Esta área é restrita ao administrador.' });
  }
  next();
}

/* ── Limite de tentativas de login ──────────────────── */
// Guardado no banco (lib/limite): não zera quando a API reinicia. Duas chaves:
// o e-mail (8 falhas / 15 min) e o IP (30 falhas / 15 min, para quem tenta muitos e-mails).

const limite = require('./limite');

const JANELA = 15 * 60e3;
const MAX_EMAIL = 8;
const MAX_IP = 30;

const bloqueado = (email, ip) =>
  Math.max(limite.minutosBloqueado(`login:${email}`, MAX_EMAIL), ip ? limite.minutosBloqueado(`login-ip:${ip}`, MAX_IP) : 0);

function registrarFalha(email, ip) {
  limite.registrar(`login:${email}`, JANELA);
  if (ip) limite.registrar(`login-ip:${ip}`, JANELA);
}

// Login certo zera só o contador do e-mail; o do IP continua (um IP não "se limpa" acertando uma conta).
const limparTentativas = email => limite.limpar(`login:${email}`);

module.exports = {
  hashSenha, conferirSenha, senhaProvisoria,
  criarSessao, encerrarSessao, encerrarSessoesDe, limparExpiradas,
  gravarCookie, apagarCookie,
  usuarioDaRequisicao, exigirLogin, exigirAdmin,
  bloqueado, registrarFalha, limparTentativas,
};
