const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { exigirLogin } = require('../lib/auth');
const { paraReais }   = require('../lib/money');
const { transacao, validar } = require('../lib/schemas');
const { resolverCategoria }  = require('../lib/categorias');

router.use(exigirLogin);

// Formato da API: `valor` em reais e `cat` com o nome (o front não precisa saber de centavos nem de ids).
const SELECT = `
  SELECT t.id, t.descricao, t.valor_centavos, t.tipo, t.categoria_id, c.nome AS cat, t.data, t.obs
  FROM transactions t JOIN categorias c ON c.id = t.categoria_id
`;

const paraApi = r => ({
  id: r.id, desc: r.descricao, valor: paraReais(r.valor_centavos), tipo: r.tipo,
  cat: r.cat, categoria_id: r.categoria_id, data: r.data, obs: r.obs,
});

const buscar = (id, userId) => {
  const r = db.prepare(`${SELECT} WHERE t.id = ? AND t.user_id = ?`).get(id, userId);
  return r ? paraApi(r) : null;
};

// Valida o corpo e resolve a categoria. Devolve { dados } ou { status, error }.
function preparar(req) {
  const { value, error } = validar(transacao, req.body);
  if (error) return { status: 400, error };
  const categoria = resolverCategoria(req.user.id, value);
  if (!categoria) return { status: 400, error: 'Categoria não encontrada.' };
  return { dados: { ...value, categoria_id: categoria.id } };
}

router.get('/', (req, res) => {
  res.json(db.prepare(`${SELECT} WHERE t.user_id = ? ORDER BY t.data DESC, t.id DESC`).all(req.user.id).map(paraApi));
});

router.post('/', (req, res) => {
  const { dados, error, status } = preparar(req);
  if (error) return res.status(status).json({ error });

  const r = db.prepare(
    'INSERT INTO transactions (user_id, descricao, valor_centavos, tipo, categoria_id, data, obs) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(req.user.id, dados.desc, dados.valor, dados.tipo, dados.categoria_id, dados.data, dados.obs);
  res.status(201).json(buscar(Number(r.lastInsertRowid), req.user.id));
});

router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const { dados, error, status } = preparar(req);
  if (error) return res.status(status).json({ error });

  const r = db.prepare(
    'UPDATE transactions SET descricao = ?, valor_centavos = ?, tipo = ?, categoria_id = ?, data = ?, obs = ? WHERE id = ? AND user_id = ?'
  ).run(dados.desc, dados.valor, dados.tipo, dados.categoria_id, dados.data, dados.obs, id, req.user.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Lançamento não encontrado.' });
  res.json(buscar(id, req.user.id));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.user.id);
  res.json({ ok: true });
});

module.exports = router;
