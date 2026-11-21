const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { exigirLogin } = require('../lib/auth');
const { paraReais }   = require('../lib/money');
const { mesValido }   = require('../lib/datas');
const { transacao, validar } = require('../lib/schemas');
const { resolverCategoria }  = require('../lib/categorias');
const { resolverConta }      = require('../lib/contas');

router.use(exigirLogin);

// Formato da API: `valor` em reais e `cat`/`conta` com os nomes (além dos ids).
const SELECT = `
  SELECT t.id, t.descricao, t.valor_centavos, t.tipo, t.categoria_id, c.nome AS cat,
         t.conta_id, ct.nome AS conta, t.recorrente_id, t.data, t.obs
  FROM transactions t
  JOIN categorias c  ON c.id  = t.categoria_id
  JOIN contas     ct ON ct.id = t.conta_id
`;

const paraApi = r => ({
  id: r.id, desc: r.descricao, valor: paraReais(r.valor_centavos), tipo: r.tipo,
  cat: r.cat, categoria_id: r.categoria_id, conta: r.conta, conta_id: r.conta_id,
  recorrente_id: r.recorrente_id, data: r.data, obs: r.obs,
});

const buscar = (id, userId) => {
  const r = db.prepare(`${SELECT} WHERE t.id = ? AND t.user_id = ?`).get(id, userId);
  return r ? paraApi(r) : null;
};

// Valida o corpo e resolve categoria e conta (sempre dentro das do usuário).
function preparar(req) {
  const { value, error } = validar(transacao, req.body);
  if (error) return { status: 400, error };
  const categoria = resolverCategoria(req.user.id, value);
  if (!categoria) return { status: 400, error: 'Categoria não encontrada.' };
  const conta_id = resolverConta(req.user.id, value.conta_id);
  if (!conta_id) return { status: 400, error: 'Conta não encontrada ou arquivada.' };
  return { dados: { ...value, categoria_id: categoria.id, conta_id } };
}

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

// GET /api/transactions?mes=&tipo=&categoria_id=&conta_id=&q=&pagina=1&limite=20
// Os totais valem para todo o filtro, não só para a página devolvida.
router.get('/', (req, res) => {
  const f = filtros(req.query, req.user.id);
  if (f.error) return res.status(400).json({ error: f.error });

  const limite = Math.min(inteiroPositivo(req.query.limite, 20), 100);
  let pagina = inteiroPositivo(req.query.pagina, 1);

  const totais = db.prepare(`
    SELECT COUNT(*) AS total,
           COALESCE(SUM(CASE WHEN t.tipo = 'entrada' THEN t.valor_centavos END), 0) AS entradas,
           COALESCE(SUM(CASE WHEN t.tipo = 'saida'   THEN t.valor_centavos END), 0) AS saidas
    FROM transactions t WHERE ${f.where}
  `).get(...f.args);

  const paginas = Math.max(1, Math.ceil(totais.total / limite));
  pagina = Math.min(pagina, paginas);

  const itens = db.prepare(`${SELECT} WHERE ${f.where} ORDER BY t.data DESC, t.id DESC LIMIT ? OFFSET ?`)
    .all(...f.args, limite, (pagina - 1) * limite).map(paraApi);

  res.json({
    itens, total: totais.total, pagina, paginas, limite,
    totais: {
      entradas: paraReais(totais.entradas),
      saidas:   paraReais(totais.saidas),
      saldo:    paraReais(totais.entradas - totais.saidas),
    },
  });
});

router.post('/', (req, res) => {
  const { dados, error, status } = preparar(req);
  if (error) return res.status(status).json({ error });

  const r = db.prepare(`
    INSERT INTO transactions (user_id, conta_id, descricao, valor_centavos, tipo, categoria_id, data, obs)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.user.id, dados.conta_id, dados.desc, dados.valor, dados.tipo, dados.categoria_id, dados.data, dados.obs);
  res.status(201).json(buscar(Number(r.lastInsertRowid), req.user.id));
});

router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const { dados, error, status } = preparar(req);
  if (error) return res.status(status).json({ error });

  const r = db.prepare(`
    UPDATE transactions SET conta_id = ?, descricao = ?, valor_centavos = ?, tipo = ?, categoria_id = ?, data = ?, obs = ?
    WHERE id = ? AND user_id = ?
  `).run(dados.conta_id, dados.desc, dados.valor, dados.tipo, dados.categoria_id, dados.data, dados.obs, id, req.user.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Lançamento não encontrado.' });
  res.json(buscar(id, req.user.id));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.user.id);
  res.json({ ok: true });
});

module.exports = router;
module.exports.SELECT = SELECT;
module.exports.paraApi = paraApi;
