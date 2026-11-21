const crypto = require('crypto');
const db = require('../db');

const hash = token => crypto.createHash('sha256').update(token).digest('hex');

const VALIDADE_MIN = { redefinir_senha: 60, verificar_email: 24 * 60 };

// Cria um token de uso único e invalida os anteriores do mesmo tipo.
// Só o hash vai para o banco: quem lê o banco não consegue usar o link.
function criarToken(userId, tipo) {
  const token = crypto.randomBytes(32).toString('base64url');
  const agora = new Date();
  db.transaction(() => {
    db.prepare('DELETE FROM tokens WHERE user_id = ? AND tipo = ?').run(userId, tipo);
    db.prepare('INSERT INTO tokens (user_id, tipo, token_hash, criado_em, expira_em) VALUES (?, ?, ?, ?, ?)')
      .run(userId, tipo, hash(token), agora.toISOString(), new Date(agora.getTime() + VALIDADE_MIN[tipo] * 60e3).toISOString());
  })();
  return { token, validadeMin: VALIDADE_MIN[tipo] };
}

// Token válido (existe, do tipo certo, não usado, não expirado) ou null.
function buscarToken(token, tipo) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null;
  return db.prepare('SELECT * FROM tokens WHERE token_hash = ? AND tipo = ? AND usado_em IS NULL AND expira_em > ?')
    .get(hash(token), tipo, new Date().toISOString()) || null;
}

const consumirToken = id => db.prepare('UPDATE tokens SET usado_em = ? WHERE id = ?').run(new Date().toISOString(), id);

module.exports = { criarToken, buscarToken, consumirToken };
