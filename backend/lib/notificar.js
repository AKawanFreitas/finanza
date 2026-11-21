const db = require('../db');
const { enviarEmail } = require('./email');

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
    console.error(`[email] falha ao enviar "${tipo}" para o usuário ${userId}: ${err.message}`);
    db.prepare('DELETE FROM notificacoes WHERE id = ?').run(Number(r.lastInsertRowid));
  });
  return true;
}

module.exports = { notificarUmaVez };
