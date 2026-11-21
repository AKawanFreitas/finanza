const db = require('../db');
const { paraReais } = require('./money');
const { hojeBR, diasEntre } = require('./datas');

const SELECT = `
  SELECT cp.id, cp.descricao, cp.valor_centavos, cp.vencimento, cp.categoria_id, c.nome AS cat,
         cp.conta_id, ct.nome AS conta, cp.obs, cp.transacao_id, t.data AS pago_em
  FROM contas_pagar cp
  JOIN categorias c ON c.id = cp.categoria_id
  LEFT JOIN contas ct ON ct.id = cp.conta_id
  LEFT JOIN transactions t ON t.id = cp.transacao_id
`;

// paga: tem lançamento vinculado · atrasada: sem lançamento e vencimento anterior a hoje · pendente: o resto
function statusDe(r, hoje) {
  if (r.transacao_id) return 'paga';
  return r.vencimento < hoje ? 'atrasada' : 'pendente';
}

function paraApi(r, hoje = hojeBR()) {
  const status = statusDe(r, hoje);
  return {
    id: r.id, descricao: r.descricao, valor: paraReais(r.valor_centavos), vencimento: r.vencimento,
    cat: r.cat, categoria_id: r.categoria_id, conta: r.conta, conta_id: r.conta_id, obs: r.obs,
    status, pago_em: r.pago_em ?? null, transacao_id: r.transacao_id,
    // Dias até o vencimento (negativo = dias de atraso). Só para o que ainda está em aberto.
    dias: status === 'paga' ? null : diasEntre(hoje, r.vencimento),
  };
}

const buscar = (id, userId, hoje) => {
  const r = db.prepare(`${SELECT} WHERE cp.id = ? AND cp.user_id = ?`).get(id, userId);
  return r ? paraApi(r, hoje) : null;
};

// Lista com filtros: status (abertas|pendente|atrasada|paga|todas) e mes (AAAA-MM do vencimento).
function listar(userId, { status = 'todas', mes, hoje = hojeBR() } = {}) {
  const onde = ['cp.user_id = ?'];
  const args = [userId];
  if (mes) { onde.push('substr(cp.vencimento, 1, 7) = ?'); args.push(mes); }
  if (status === 'paga') onde.push('cp.transacao_id IS NOT NULL');
  else if (status === 'abertas') onde.push('cp.transacao_id IS NULL');
  else if (status === 'atrasada') { onde.push('cp.transacao_id IS NULL AND cp.vencimento < ?'); args.push(hoje); }
  else if (status === 'pendente') { onde.push('cp.transacao_id IS NULL AND cp.vencimento >= ?'); args.push(hoje); }
  // Em aberto, do mais antigo (mais urgente) ao mais novo; pagas por último, da mais recente.
  return db.prepare(`${SELECT} WHERE ${onde.join(' AND ')} ORDER BY (cp.transacao_id IS NOT NULL), cp.vencimento ASC, cp.id ASC`)
    .all(...args).map(r => paraApi(r, hoje));
}

// Totais do que está em aberto, para o cabeçalho da tela.
function totais(userId, hoje = hojeBR()) {
  const r = db.prepare(`
    SELECT COALESCE(SUM(CASE WHEN vencimento >= ? THEN valor_centavos END), 0) AS pendente,
           COALESCE(SUM(CASE WHEN vencimento <  ? THEN valor_centavos END), 0) AS atrasado,
           COUNT(CASE WHEN vencimento < ? THEN 1 END) AS qtd_atrasadas
    FROM contas_pagar WHERE user_id = ? AND transacao_id IS NULL
  `).get(hoje, hoje, hoje, userId);
  return { pendente: paraReais(r.pendente), atrasado: paraReais(r.atrasado), qtd_atrasadas: r.qtd_atrasadas };
}

module.exports = { listar, buscar, totais, statusDe, paraApi };
