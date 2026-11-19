const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { exigirLogin } = require('../lib/auth');

router.use(exigirLogin);

const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

function parseCategoria(body = {}) {
  const nome = typeof body.nome === 'string' ? body.nome.trim() : '';
  const cor  = body.cor;

  if (!nome)                     return { error: 'Informe o nome da categoria.' };
  if (nome.length > 40)          return { error: 'O nome deve ter até 40 caracteres.' };
  if (!COLOR_RE.test(cor || '')) return { error: 'A cor deve estar no formato #RRGGBB.' };
  return { value: { nome, cor } };
}

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM categorias WHERE user_id = ? ORDER BY nome ASC').all(req.user.id));
});

router.post('/', (req, res) => {
  const { value, error } = parseCategoria(req.body);
  if (error) return res.status(400).json({ error });

  const { nome, cor } = value;
  const exists = db.prepare('SELECT 1 FROM categorias WHERE user_id = ? AND nome = ? COLLATE NOCASE').get(req.user.id, nome);
  if (exists) return res.status(409).json({ error: 'Já existe uma categoria com esse nome.' });

  const result = db.prepare('INSERT INTO categorias (user_id, nome, cor) VALUES (?, ?, ?)').run(req.user.id, nome, cor);
  res.status(201).json({ id: Number(result.lastInsertRowid), nome, cor });
});

// Lançamentos e recorrentes guardam a categoria pelo nome, então renomear acompanha os dois.
const updateCategoria = db.transaction((userId, id, atual, { nome, cor }) => {
  db.prepare('UPDATE categorias SET nome = ?, cor = ? WHERE id = ? AND user_id = ?').run(nome, cor, id, userId);
  if (nome !== atual.nome) {
    db.prepare('UPDATE transactions SET cat = ? WHERE cat = ? AND user_id = ?').run(nome, atual.nome, userId);
    db.prepare('UPDATE recorrentes  SET cat = ? WHERE cat = ? AND user_id = ?').run(nome, atual.nome, userId);
  }
});

router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const { value, error } = parseCategoria(req.body);
  if (error) return res.status(400).json({ error });

  const atual = db.prepare('SELECT * FROM categorias WHERE id = ? AND user_id = ?').get(id, req.user.id);
  if (!atual) return res.status(404).json({ error: 'Categoria não encontrada.' });

  const duplicada = db.prepare('SELECT 1 FROM categorias WHERE user_id = ? AND nome = ? COLLATE NOCASE AND id != ?')
    .get(req.user.id, value.nome, id);
  if (duplicada) return res.status(409).json({ error: 'Já existe uma categoria com esse nome.' });

  updateCategoria(req.user.id, id, atual, value);
  res.json({ id, ...value });
});

router.delete('/:id', (req, res) => {
  const id  = Number(req.params.id);
  const cat = db.prepare('SELECT nome FROM categorias WHERE id = ? AND user_id = ?').get(id, req.user.id);
  if (!cat) return res.status(404).json({ error: 'Categoria não encontrada.' });

  const emUso =
    db.prepare('SELECT COUNT(*) AS n FROM transactions WHERE cat = ? AND user_id = ?').get(cat.nome, req.user.id).n +
    db.prepare('SELECT COUNT(*) AS n FROM recorrentes  WHERE cat = ? AND user_id = ?').get(cat.nome, req.user.id).n;
  if (emUso > 0) {
    return res.status(409).json({ error: `"${cat.nome}" está em uso por ${emUso} registro(s). Mude a categoria deles antes de excluir.` });
  }

  db.prepare('DELETE FROM categorias WHERE id = ? AND user_id = ?').run(id, req.user.id);
  res.json({ ok: true });
});

module.exports = router;
