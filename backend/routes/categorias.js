const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { exigirLogin } = require('../lib/auth');
const { categoriaInput, validar } = require('../lib/schemas');

router.use(exigirLogin);

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT id, nome, cor FROM categorias WHERE user_id = ? ORDER BY nome ASC').all(req.user.id));
});

router.post('/', (req, res) => {
  const { value, error } = validar(categoriaInput, req.body);
  if (error) return res.status(400).json({ error });

  const { nome, cor } = value;
  const exists = db.prepare('SELECT 1 FROM categorias WHERE user_id = ? AND nome = ? COLLATE NOCASE').get(req.user.id, nome);
  if (exists) return res.status(409).json({ error: 'Já existe uma categoria com esse nome.' });

  const result = db.prepare('INSERT INTO categorias (user_id, nome, cor) VALUES (?, ?, ?)').run(req.user.id, nome, cor);
  res.status(201).json({ id: Number(result.lastInsertRowid), nome, cor });
});

// Lançamentos e recorrentes apontam por id, então renomear é só atualizar a categoria.
router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const { value, error } = validar(categoriaInput, req.body);
  if (error) return res.status(400).json({ error });

  const atual = db.prepare('SELECT id FROM categorias WHERE id = ? AND user_id = ?').get(id, req.user.id);
  if (!atual) return res.status(404).json({ error: 'Categoria não encontrada.' });

  const duplicada = db.prepare('SELECT 1 FROM categorias WHERE user_id = ? AND nome = ? COLLATE NOCASE AND id != ?')
    .get(req.user.id, value.nome, id);
  if (duplicada) return res.status(409).json({ error: 'Já existe uma categoria com esse nome.' });

  db.prepare('UPDATE categorias SET nome = ?, cor = ? WHERE id = ? AND user_id = ?').run(value.nome, value.cor, id, req.user.id);
  res.json({ id, ...value });
});

router.delete('/:id', (req, res) => {
  const id  = Number(req.params.id);
  const cat = db.prepare('SELECT nome FROM categorias WHERE id = ? AND user_id = ?').get(id, req.user.id);
  if (!cat) return res.status(404).json({ error: 'Categoria não encontrada.' });

  if (db.prepare('SELECT 1 FROM orcamentos WHERE categoria_id = ?').get(id)) {
    return res.status(409).json({ error: `"${cat.nome}" tem um orçamento. Remova o orçamento antes de excluir a categoria.` });
  }

  const emUso =
    db.prepare('SELECT COUNT(*) AS n FROM transactions WHERE categoria_id = ?').get(id).n +
    db.prepare('SELECT COUNT(*) AS n FROM recorrentes  WHERE categoria_id = ?').get(id).n;
  if (emUso > 0) {
    return res.status(409).json({ error: `"${cat.nome}" está em uso por ${emUso} registro(s). Mude a categoria deles antes de excluir.` });
  }

  db.prepare('DELETE FROM categorias WHERE id = ? AND user_id = ?').run(id, req.user.id);
  res.json({ ok: true });
});

module.exports = router;
