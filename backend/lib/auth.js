const crypto = require('crypto');
const db = require('../db');
const suporte = require('./suporte');

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
         u.email_verificado_em, u.notificacoes_email, s.chamado_id
  FROM sessions s JOIN users u ON u.id = s.user_id
  WHERE s.token_hash = ? AND s.expira_em > ?
`;

const SELECT_CLIENTE = `
  SELECT id, nome, email, papel, status, trocar_senha, criado_em, ultimo_acesso, email_verificado_em, notificacoes_email
  FROM users WHERE id = ?
`;

// Vincula a sessão do administrador a um chamado de suporte aberto (ou desvincula, com null).
const vincularSessao = (token, chamadoId) =>
  db.prepare('UPDATE sessions SET chamado_id = ? WHERE token_hash = ?').run(chamadoId, hashToken(token));

// Quem está agindo. Em um chamado de suporte aberto, é a conta do CLIENTE (com `suporte` preenchido):
// toda rota enxerga os dados dele, e as áreas de administrador ficam fechadas até o chamado acabar.
function usuarioDaRequisicao(req) {
  const token = lerCookie(req);
  if (!token) return null;
  const real = db.prepare(SELECT_USER).get(hashToken(token), new Date().toISOString());
  if (!real || real.status !== 'ativo') return null;

  const { chamado_id: chamadoId, ...resto } = real;
  const admin = { ...resto, trocar_senha: !!resto.trocar_senha, token };
  if (!chamadoId) return admin;

  const chamado = suporte.chamadoAberto(chamadoId);
  if (!chamado) { vincularSessao(token, null); return admin; }
  if (suporte.vencido(chamado)) { suporte.encerrar(chamado.id, 'tempo'); return admin; }

  const cliente = db.prepare(SELECT_CLIENTE).get(chamado.user_id);
  if (!cliente || cliente.status !== 'ativo') { suporte.encerrar(chamado.id, 'sistema'); return admin; }
  // A troca de senha pendente do cliente não trava o suporte: o administrador não usa a senha dele.
  return { ...cliente, trocar_senha: false, token, suporte: { chamado, admin: { id: admin.id, nome: admin.nome } } };
}

// Exige sessão válida. Com a senha marcada para troca, só libera o que é preciso para trocá-la.
function exigirLogin(req, res, next) {
  const user = usuarioDaRequisicao(req);
  if (!user) return res.status(401).json({ error: 'Entre na sua conta para continuar.' });

  const liberado = req.method === 'GET' || req.path === '/senha' || req.path === '/logout';
  if (user.trocar_senha && !liberado) {
    return res.status(403).json({ error: 'Defina uma nova senha para continuar.', trocar_senha: true });
  }

  if (user.suporte) {
    const caminho = req.originalUrl.split('?')[0];
    if (suporte.bloqueada(req.method, caminho)) return res.status(403).json({ error: suporte.MENSAGEM_BLOQUEIO });
    // Agir (alterar dados) conta como atividade e fica registrado no chamado. As rotas /api/suporte cuidam de si.
    if (req.method !== 'GET' && !caminho.startsWith('/api/suporte')) {
      suporte.renovar(user.suporte.chamado.id);
      res.on('finish', () => suporte.registrarAcao(user.suporte.chamado.id, req.method, caminho, res.statusCode));
    }
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
// Guardado no banco (lib/limite): não zera quando a API reinicia. Três chaves, numa janela de 15 min:
//   e-mail + IP   8 falhas   quem erra a senha de uma conta trava só a si mesmo, não o dono, que entra de outro IP;
//   IP           30 falhas   quem tenta muitos e-mails a partir da mesma máquina;
//   e-mail       50 falhas   teto por conta contra ataque distribuído (muitos IPs). Redefinir a senha libera.

const limite = require('./limite');

const JANELA = 15 * 60e3;
const MAX_PAR = 8;
const MAX_IP = 30;
const MAX_EMAIL = 50;

const chavePar = (email, ip) => `login:${email}|${ip || '-'}`;

const bloqueado = (email, ip) => Math.max(
  limite.minutosBloqueado(chavePar(email, ip), MAX_PAR),
  limite.minutosBloqueado(`login:${email}`, MAX_EMAIL),
  ip ? limite.minutosBloqueado(`login-ip:${ip}`, MAX_IP) : 0,
);

function registrarFalha(email, ip) {
  limite.registrar(chavePar(email, ip), JANELA);
  limite.registrar(`login:${email}`, JANELA);
  if (ip) limite.registrar(`login-ip:${ip}`, JANELA);
}

// Login certo (ou senha redefinida pelo e-mail) zera os contadores da conta; o do IP continua
// (um IP não "se limpa" acertando uma conta).
const limparTentativas = email => limite.limparPrefixo(`login:${email}`);

module.exports = {
  hashSenha, conferirSenha, senhaProvisoria,
  criarSessao, encerrarSessao, encerrarSessoesDe, limparExpiradas, vincularSessao,
  gravarCookie, apagarCookie,
  usuarioDaRequisicao, exigirLogin, exigirAdmin,
  bloqueado, registrarFalha, limparTentativas,
};
