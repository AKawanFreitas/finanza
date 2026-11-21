const db = require('../db');
const { enviarEmail } = require('./email');
const logger = require('./logger');

// Envia um e-mail automático no máximo uma vez para (usuário, tipo, chave).
// Só vai para quem está ativo, confirmou o e-mail e não desativou os avisos.
// `montar(user)` devolve { assunto, texto, html }. Retorna true se disparou o envio.
// O registro é gravado antes: se o envio falhar, ele é desfeito para a próxima rodada tentar de novo.
function notificarUmaVez(userId, tipo, chave, montar) {
  const user = db.prepare(
    'SELECT id, nome, email, status, email_verificado_em, notificacoes_email FROM users WHERE id = ?'
  ).get(userId);
  if (!user || user.status !== 'ativo' || !user.email_verificado_em || !user.notificacoes_email) return false;

  const r = db.prepare('INSERT OR IGNORE INTO notificacoes (user_id, tipo, chave, criado_em) VALUES (?, ?, ?, ?)')
    .run(userId, tipo, chave, new Date().toISOString());
  if (r.changes === 0) return false;

  enviarEmail({ para: user.email, ...montar(user) }).catch(err => {
    logger.error({ err, tipo, userId }, 'falha ao enviar e-mail automático');
    db.prepare('DELETE FROM notificacoes WHERE id = ?').run(Number(r.lastInsertRowid));
  });
  return true;
}

// Como notificarUmaVez, mas para vários itens de uma vez: só entram no e-mail os que ainda não foram avisados,
// e a pessoa recebe UM e-mail com todos (e não um por item). `chaveDe(item)` identifica cada item.
// Se o envio falhar, os registros são desfeitos para a próxima rodada tentar de novo.
function notificarLote(userId, tipo, itens, chaveDe, montar) {
  const user = db.prepare(
    'SELECT id, nome, email, status, email_verificado_em, notificacoes_email FROM users WHERE id = ?'
  ).get(userId);
  if (!user || user.status !== 'ativo' || !user.email_verificado_em || !user.notificacoes_email || itens.length === 0) return 0;

  const registrar = db.prepare('INSERT OR IGNORE INTO notificacoes (user_id, tipo, chave, criado_em) VALUES (?, ?, ?, ?)');
  const agora = new Date().toISOString();
  const novos = db.transaction(() => itens.filter(i => registrar.run(userId, tipo, chaveDe(i), agora).changes > 0))();
  if (novos.length === 0) return 0;

  enviarEmail({ para: user.email, ...montar(user, novos) }).catch(err => {
    logger.error({ err, tipo, userId }, 'falha ao enviar e-mail em lote');
    const apagar = db.prepare('DELETE FROM notificacoes WHERE user_id = ? AND tipo = ? AND chave = ?');
    db.transaction(() => novos.forEach(i => apagar.run(userId, tipo, chaveDe(i))))();
  });
  return novos.length;
}

module.exports = { notificarUmaVez, notificarLote };
