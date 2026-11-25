const db = require('../db');

const SALDO_SQL = `
  c.saldo_inicial_centavos
  + COALESCE((SELECT SUM(CASE t.tipo WHEN 'entrada' THEN t.valor_centavos ELSE -t.valor_centavos END)
              FROM transactions t WHERE t.conta_id = c.id), 0)
  + COALESCE((SELECT SUM(valor_centavos) FROM transferencias WHERE destino_id = c.id), 0)
  - COALESCE((SELECT SUM(valor_centavos) FROM transferencias WHERE origem_id = c.id), 0)
`;

// Contas do usuário com o saldo atual (inicial + lançamentos + transferências), em centavos.
function listarContas(userId, { id } = {}) {
  return db.prepare(`
    SELECT c.id, c.nome, c.tipo, c.cor, c.saldo_inicial_centavos, c.arquivada, ${SALDO_SQL} AS saldo_centavos
    FROM contas c
    WHERE c.user_id = ? ${id ? 'AND c.id = ?' : ''}
    ORDER BY c.arquivada ASC, c.id ASC
  `).all(...(id ? [userId, id] : [userId]));
}

// A conta usada quando nenhuma é informada: a mais antiga que não está arquivada.
// Toda conta de usuário tem ao menos uma; se faltar (ex.: criada por script), cria.
function contaPadrao(userId) {
  const existente = db.prepare('SELECT id FROM contas WHERE user_id = ? AND arquivada = 0 ORDER BY id LIMIT 1').get(userId);
  if (existente) return existente.id;
  return Number(db.prepare(
    "INSERT INTO contas (user_id, nome, tipo, criado_em) VALUES (?, 'Conta principal', 'corrente', ?)"
  ).run(userId, new Date().toISOString()).lastInsertRowid);
}

// Conta do usuário para receber lançamentos: tem de existir, ser dele e não estar arquivada.
// Sem id, usa a padrão. Devolve o id ou null.
function resolverConta(userId, contaId) {
  if (contaId === undefined || contaId === null) return contaPadrao(userId);
  const c = db.prepare('SELECT id FROM contas WHERE id = ? AND user_id = ? AND arquivada = 0').get(contaId, userId);
  return c ? c.id : null;
}

// Apaga uma conta (ou cartão) já conferida como sem movimentações. Recorrentes e contas a pagar que só a
// tinham como conta planejada ficam sem conta (e passam a usar a principal), em vez de travar a exclusão na FK.
const excluirConta = db.transaction((id) => {
  db.prepare('UPDATE recorrentes  SET conta_id = NULL WHERE conta_id = ?').run(id);
  db.prepare('UPDATE contas_pagar SET conta_id = NULL WHERE conta_id = ?').run(id);
  db.prepare('DELETE FROM contas WHERE id = ?').run(id);
});

module.exports = { listarContas, contaPadrao, resolverConta, excluirConta };
