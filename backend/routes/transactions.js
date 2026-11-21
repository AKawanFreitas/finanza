const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { exigirLogin } = require('../lib/auth');
const { paraReais }   = require('../lib/money');
const { SELECT, paraApi, filtros, inteiroPositivo } = require('../lib/transacoes');
const { transacao, validar } = require('../lib/schemas');
const { resolverCategoria }  = require('../lib/categorias');
const { resolverConta }      = require('../lib/contas');
const { aposLancamentos }    = require('../lib/orcamentos');

router.use(exigirLogin);

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
  aposLancamentos(req.user.id, [dados]);
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
  aposLancamentos(req.user.id, [dados]);
  res.json(buscar(id, req.user.id));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.user.id);
  res.json({ ok: true });
});

module.exports = router;
