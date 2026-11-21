const db = require('../db');
const { paraReais } = require('./money');
const { mesAtual } = require('./datas');
const { notificarUmaVez } = require('./notificar');
const { alertaOrcamento } = require('./templates');

const LIMITE_ATENCAO = 80;
const LIMITE_ESTOURADO = 100;

const statusDe = pct => (pct >= LIMITE_ESTOURADO ? 'estourado' : pct >= LIMITE_ATENCAO ? 'atencao' : 'ok');

const SELECT = `
  SELECT o.categoria_id, c.nome AS cat, c.cor, o.valor_centavos AS limite,
         COALESCE((SELECT SUM(t.valor_centavos) FROM transactions t
                   WHERE t.user_id = o.user_id AND t.categoria_id = o.categoria_id
                     AND t.tipo = 'saida' AND substr(t.data, 1, 7) = :mes), 0) AS gasto
  FROM orcamentos o JOIN categorias c ON c.id = o.categoria_id
  WHERE o.user_id = :uid
`;

function paraApi(r) {
  // Arredonda para baixo: 79,99% não pode virar "80%" e disparar o aviso antes da hora.
  const percentual = Math.floor((r.gasto * 1000) / r.limite) / 10;
  return {
    categoria_id: r.categoria_id, cat: r.cat, cor: r.cor,
    limite: paraReais(r.limite), gasto: paraReais(r.gasto), restante: paraReais(r.limite - r.gasto),
    percentual, status: statusDe(percentual),
  };
}

// Orçamentos do usuário com o gasto do mês, do mais comprometido para o menos.
function listarOrcamentos(userId, mes) {
  return db.prepare(`${SELECT} ORDER BY CAST(gasto AS REAL) / limite DESC, c.nome`).all({ uid: userId, mes }).map(paraApi);
}

function buscarOrcamento(userId, categoriaId, mes) {
  const r = db.prepare(`${SELECT} AND o.categoria_id = :cat`).get({ uid: userId, mes, cat: categoriaId });
  return r ? paraApi(r) : null;
}

// Depois de um gasto, avisa por e-mail quando a categoria chega a 80% e a 100% do limite.
// Cada nível é avisado uma vez por mês. Só vale para o mês corrente: lançar ou importar
// um gasto antigo não deve disparar alerta.
function avaliarOrcamento(userId, categoriaId, mes) {
  if (mes !== mesAtual()) return;
  const o = buscarOrcamento(userId, categoriaId, mes);
  if (!o) return;
  const nivel = o.percentual >= LIMITE_ESTOURADO ? LIMITE_ESTOURADO : o.percentual >= LIMITE_ATENCAO ? LIMITE_ATENCAO : 0;
  if (!nivel) return;
  notificarUmaVez(userId, 'orcamento', `${mes}:${categoriaId}:${nivel}`, user =>
    alertaOrcamento({ nome: user.nome, categoria: o.cat, limite: o.limite, gasto: o.gasto, percentual: o.percentual, mes }));
}

// Atalho para as rotas: chame depois de gravar lançamentos. Aceita itens { tipo, data, categoria_id }.
function aposLancamentos(userId, itens) {
  const vistos = new Set();
  for (const i of itens) {
    if (i.tipo !== 'saida') continue;
    const chave = `${i.categoria_id}|${i.data.slice(0, 7)}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    avaliarOrcamento(userId, i.categoria_id, i.data.slice(0, 7));
  }
}

module.exports = { listarOrcamentos, buscarOrcamento, avaliarOrcamento, aposLancamentos, statusDe };
