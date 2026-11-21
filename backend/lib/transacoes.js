const db = require('../db');
const { paraReais } = require('./money');
const { mesValido } = require('./datas');
const { FATURA_SQL } = require('./cartoes');

// Formato da API: `valor` em reais e `cat`/`conta` com os nomes (além dos ids).
const SELECT = `
  SELECT t.id, t.descricao, t.valor_centavos, t.tipo, t.categoria_id, c.nome AS cat,
         t.conta_id, ct.nome AS conta, t.recorrente_id, t.data, t.obs,
         t.grupo_parcelas, t.parcela_numero, t.parcela_total,
         CASE WHEN k.conta_id IS NULL THEN NULL ELSE ${FATURA_SQL} END AS fatura
  FROM transactions t
  JOIN categorias c  ON c.id  = t.categoria_id
  JOIN contas     ct ON ct.id = t.conta_id
  LEFT JOIN cartoes k ON k.conta_id = t.conta_id
`;

const paraApi = r => ({
  id: r.id, desc: r.descricao, valor: paraReais(r.valor_centavos), tipo: r.tipo,
  cat: r.cat, categoria_id: r.categoria_id, conta: r.conta, conta_id: r.conta_id,
  recorrente_id: r.recorrente_id, data: r.data, obs: r.obs,
  fatura: r.fatura, grupo_parcelas: r.grupo_parcelas,
  parcela: r.parcela_total ? { numero: r.parcela_numero, total: r.parcela_total } : null,
});

const inteiroPositivo = (v, padrao) => {
  const n = Number.parseInt(v, 10);
  return Number.isInteger(n) && n > 0 ? n : padrao;
};

// Filtros da listagem: mes (AAAA-MM), tipo, categoria_id, conta_id, q (descrição/observação, sem acento).
function filtros(query, userId) {
  const onde = ['t.user_id = ?'];
  const args = [userId];

  if (query.mes !== undefined && query.mes !== '') {
    if (!mesValido(query.mes)) return { error: 'O mês deve estar no formato AAAA-MM.' };
    onde.push("substr(t.data, 1, 7) = ?"); args.push(query.mes);
  }
  if (query.tipo) {
    if (query.tipo !== 'entrada' && query.tipo !== 'saida') return { error: 'O tipo deve ser "entrada" ou "saida".' };
    onde.push('t.tipo = ?'); args.push(query.tipo);
  }
  if (query.categoria_id) { onde.push('t.categoria_id = ?'); args.push(inteiroPositivo(query.categoria_id, -1)); }
  if (query.conta_id)     { onde.push('t.conta_id = ?');     args.push(inteiroPositivo(query.conta_id, -1)); }
  if (typeof query.q === 'string' && query.q.trim()) {
    const termo = db.normalizar(query.q.trim()).replace(/[\\%_]/g, m => `\\${m}`);
    onde.push("(normalizar(t.descricao) LIKE ? ESCAPE '\\' OR normalizar(t.obs) LIKE ? ESCAPE '\\')");
    args.push(`%${termo}%`, `%${termo}%`);
  }
  return { where: onde.join(' AND '), args };
}

module.exports = { SELECT, paraApi, filtros, inteiroPositivo };
