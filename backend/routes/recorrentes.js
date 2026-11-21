const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { exigirLogin } = require('../lib/auth');
const { paraReais }   = require('../lib/money');
const { recorrente, validar } = require('../lib/schemas');
const { resolverCategoria }   = require('../lib/categorias');

router.use(exigirLogin);

const SELECT = `
  SELECT r.id, r.nome, r.valor_centavos, r.tipo, r.categoria_id, c.nome AS cat, r.dia, r.obs
  FROM recorrentes r JOIN categorias c ON c.id = r.categoria_id
`;

const paraApi = r => ({
  id: r.id, nome: r.nome, valor: paraReais(r.valor_centavos), tipo: r.tipo,
  cat: r.cat, categoria_id: r.categoria_id, dia: r.dia, obs: r.obs,
});

const buscar = (id, userId) => {
  const r = db.prepare(`${SELECT} WHERE r.id = ? AND r.user_id = ?`).get(id, userId);
  return r ? paraApi(r) : null;
};

function preparar(req) {
  const { value, error } = validar(recorrente, req.body);
  if (error) return { status: 400, error };
  const categoria = resolverCategoria(req.user.id, value);
  if (!categoria) return { status: 400, error: 'Categoria não encontrada.' };
  return { dados: { ...value, categoria_id: categoria.id } };
}

router.get('/', (req, res) => {
  res.json(db.prepare(`${SELECT} WHERE r.user_id = ? ORDER BY r.dia ASC, r.id ASC`).all(req.user.id).map(paraApi));
});

router.post('/', (req, res) => {
  const { dados, error, status } = preparar(req);
  if (error) return res.status(status).json({ error });

  const r = db.prepare(
    'INSERT INTO recorrentes (user_id, nome, valor_centavos, tipo, categoria_id, dia, obs) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(req.user.id, dados.nome, dados.valor, dados.tipo, dados.categoria_id, dados.dia, dados.obs);
  res.status(201).json(buscar(Number(r.lastInsertRowid), req.user.id));
});

router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const { dados, error, status } = preparar(req);
  if (error) return res.status(status).json({ error });

  const r = db.prepare(
    'UPDATE recorrentes SET nome = ?, valor_centavos = ?, tipo = ?, categoria_id = ?, dia = ?, obs = ? WHERE id = ? AND user_id = ?'
  ).run(dados.nome, dados.valor, dados.tipo, dados.categoria_id, dados.dia, dados.obs, id, req.user.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Recorrente não encontrado.' });
  res.json(buscar(id, req.user.id));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM recorrentes WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.user.id);
  res.json({ ok: true });
});

module.exports = router;
