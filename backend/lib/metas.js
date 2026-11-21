const db = require('../db');
const { paraReais } = require('./money');
const { hojeBR } = require('./datas');
const { notificarUmaVez } = require('./notificar');
const { metaAtingida } = require('./templates');

// Meses que faltam até o mês do prazo, contando o mês atual (prazo neste mês = 1). 0 se já passou.
function mesesAte(prazo, hoje) {
  if (prazo < hoje) return 0;
  const [py, pm] = prazo.split('-').map(Number);
  const [hy, hm] = hoje.split('-').map(Number);
  return Math.max(1, py * 12 + pm - (hy * 12 + hm));
}

function statusDe(atual, alvo, prazo, hoje) {
  if (atual >= alvo) return 'concluida';
  if (prazo && prazo < hoje) return 'atrasada';
  return 'em_andamento';
}

const SELECT = `
  SELECT m.id, m.nome, m.valor_alvo_centavos, m.prazo, m.cor, m.arquivada,
         COALESCE((SELECT SUM(valor_centavos) FROM aportes a WHERE a.meta_id = m.id), 0) AS atual_centavos,
         (SELECT COUNT(*) FROM aportes a WHERE a.meta_id = m.id) AS qtd_aportes
  FROM metas m WHERE m.user_id = ?
`;

function paraApi(r, hoje) {
  const faltam = Math.max(0, r.valor_alvo_centavos - r.atual_centavos);
  const status = statusDe(r.atual_centavos, r.valor_alvo_centavos, r.prazo, hoje);
  const meses = r.prazo && status === 'em_andamento' ? mesesAte(r.prazo, hoje) : null;
  return {
    id: r.id, nome: r.nome, cor: r.cor, arquivada: !!r.arquivada, prazo: r.prazo, status,
    valor_alvo: paraReais(r.valor_alvo_centavos), atual: paraReais(r.atual_centavos), restante: paraReais(faltam),
    percentual: Math.floor((r.atual_centavos * 1000) / r.valor_alvo_centavos) / 10,
    meses_restantes: meses,
    // Quanto guardar por mês, a partir de agora, para chegar no prazo (arredonda para cima).
    sugestao_mensal: meses ? paraReais(Math.ceil(faltam / meses)) : null,
    aportes: r.qtd_aportes,
  };
}

// Ativas primeiro; dentro delas, as com prazo mais próximo; arquivadas por último.
function listarMetas(userId, { id, hoje = hojeBR() } = {}) {
  const linhas = db.prepare(`${SELECT} ${id ? 'AND m.id = ?' : ''} ORDER BY m.arquivada, m.prazo IS NULL, m.prazo, m.id`)
    .all(...(id ? [userId, id] : [userId]));
  return linhas.map(r => paraApi(r, hoje));
}

// Depois de um aporte: se a meta acabou de ser atingida, avisa por e-mail uma única vez.
function avaliarMeta(userId, metaId) {
  const m = listarMetas(userId, { id: metaId })[0];
  if (m && m.status === 'concluida') {
    notificarUmaVez(userId, 'meta', `meta:${m.id}`, user => metaAtingida({ nome: user.nome, meta: m.nome, valor: m.atual }));
  }
}

const saldoDaMeta = metaId => db.prepare('SELECT COALESCE(SUM(valor_centavos), 0) AS s FROM aportes WHERE meta_id = ?').get(metaId).s;

module.exports = { listarMetas, avaliarMeta, saldoDaMeta, mesesAte, statusDe };
