const db = require('../db');
const { hojeBR, dataVencimento } = require('./datas');
const { contaPadrao } = require('./contas');
const { aposLancamentos } = require('./orcamentos');

// Gera o lançamento de um recorrente num mês, se ainda não houver. Devolve o id ou null.
// Roda dentro de transação: a conferência e a inserção não se separam.
const lancarUm = db.transaction((userId, rec, mes, contaId) => {
  const ja = db.prepare('SELECT 1 FROM transactions WHERE recorrente_id = ? AND substr(data, 1, 7) = ?').get(rec.id, mes);
  if (ja) return null;
  return Number(db.prepare(`
    INSERT INTO transactions (user_id, conta_id, recorrente_id, descricao, valor_centavos, tipo, categoria_id, data, obs)
    VALUES (?, ?, ?, ?, ?, 'saida', ?, ?, ?)
  `).run(userId, contaId, rec.id, rec.nome, rec.valor_centavos, rec.categoria_id, dataVencimento(mes, rec.dia), rec.obs).lastInsertRowid);
});

// Conta onde o recorrente automático lança: a escolhida, se ainda existir e estiver ativa; senão a principal.
function contaDoRecorrente(rec) {
  if (rec.conta_id) {
    const c = db.prepare('SELECT id FROM contas WHERE id = ? AND user_id = ? AND arquivada = 0').get(rec.conta_id, rec.user_id);
    if (c) return c.id;
  }
  return contaPadrao(rec.user_id);
}

// Lança os recorrentes marcados como automáticos cujo vencimento já chegou neste mês.
// Pode rodar quantas vezes quiser: quem já foi lançado é pulado. Se o servidor ficou fora do ar
// no dia do vencimento, o lançamento sai na próxima execução (com a data de vencimento correta).
function executarAutomaticos(agora = new Date()) {
  const hoje = hojeBR(agora);
  const mes = hoje.slice(0, 7);
  const recs = db.prepare(`
    SELECT r.* FROM recorrentes r JOIN users u ON u.id = r.user_id
    WHERE r.automatico = 1 AND u.status = 'ativo' ORDER BY r.user_id, r.dia, r.id
  `).all();

  let lancados = 0;
  for (const rec of recs) {
    if (dataVencimento(mes, rec.dia) > hoje) continue;
    const id = lancarUm(rec.user_id, rec, mes, contaDoRecorrente(rec));
    if (!id) continue;
    lancados++;
    aposLancamentos(rec.user_id, [{ tipo: 'saida', data: dataVencimento(mes, rec.dia), categoria_id: rec.categoria_id }]);
  }
  return lancados;
}

module.exports = { lancarUm, executarAutomaticos, contaDoRecorrente };
