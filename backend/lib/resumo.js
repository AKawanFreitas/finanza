const db = require('../db');
const { paraReais } = require('./money');
const { deslocarMes, diasNoMes } = require('./datas');
const { SELECT, paraApi } = require('./transacoes');

const MESES_HISTORICO = 6;

// Tudo o que o dashboard (e o e-mail de resumo mensal) mostra de um mês, calculado no banco.
function calcularResumo(uid, mes) {

  const primeiro = deslocarMes(mes, -(MESES_HISTORICO - 1));
  const linhas = db.prepare(`
    SELECT substr(data, 1, 7) AS mes, tipo, SUM(valor_centavos) AS total, COUNT(*) AS n
    FROM transactions WHERE user_id = ? AND substr(data, 1, 7) BETWEEN ? AND ?
    GROUP BY mes, tipo
  `).all(uid, primeiro, mes);

  const soma = (m, tipo, campo = 'total') => linhas.find(l => l.mes === m && l.tipo === tipo)?.[campo] ?? 0;

  const historico = Array.from({ length: MESES_HISTORICO }, (_, i) => {
    const m = deslocarMes(mes, i - (MESES_HISTORICO - 1));
    return { mes: m, entradas: paraReais(soma(m, 'entrada')), saidas: paraReais(soma(m, 'saida')) };
  });

  const porDia = Array(diasNoMes(mes)).fill(0);
  for (const r of db.prepare(`
    SELECT CAST(substr(data, 9, 2) AS INTEGER) AS dia, SUM(valor_centavos) AS total
    FROM transactions WHERE user_id = ? AND tipo = 'saida' AND substr(data, 1, 7) = ? GROUP BY dia
  `).all(uid, mes)) porDia[r.dia - 1] = paraReais(r.total);

  const porCategoria = db.prepare(`
    SELECT c.id AS categoria_id, c.nome AS cat, SUM(t.valor_centavos) AS total
    FROM transactions t JOIN categorias c ON c.id = t.categoria_id
    WHERE t.user_id = ? AND t.tipo = 'saida' AND substr(t.data, 1, 7) = ?
    GROUP BY c.id ORDER BY total DESC
  `).all(uid, mes).map(r => ({ categoria_id: r.categoria_id, cat: r.cat, valor: paraReais(r.total) }));

  const ultimas = db.prepare(`${SELECT} WHERE t.user_id = ? AND substr(t.data, 1, 7) = ? ORDER BY t.data DESC, t.id DESC LIMIT 8`)
    .all(uid, mes).map(paraApi);

  const entradas = soma(mes, 'entrada'), saidas = soma(mes, 'saida');
  const anterior = deslocarMes(mes, -1);

  return {
    mes,
    entradas: paraReais(entradas), saidas: paraReais(saidas), saldo: paraReais(entradas - saidas),
    anterior: { entradas: paraReais(soma(anterior, 'entrada')), saidas: paraReais(soma(anterior, 'saida')) },
    qtd: { entradas: soma(mes, 'entrada', 'n'), saidas: soma(mes, 'saida', 'n'), total: soma(mes, 'entrada', 'n') + soma(mes, 'saida', 'n') },
    porDia, porCategoria, historico, ultimas,
  };
}

module.exports = { calcularResumo, MESES_HISTORICO };
