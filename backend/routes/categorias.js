const express = require('express');
const router  = express.Router();
const db      = require('../db');

const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM categorias ORDER BY nome ASC').all());
});

router.post('/', (req, res) => {
  const nome = typeof req.body?.nome === 'string' ? req.body.nome.trim() : '';
  const cor  = req.body?.cor;

  if (!nome)                    return res.status(400).json({ error: 'Informe o nome da categoria.' });
  if (nome.length > 40)         return res.status(400).json({ error: 'O nome deve ter até 40 caracteres.' });
  if (!COLOR_RE.test(cor || '')) return res.status(400).json({ error: 'A cor deve estar no formato #RRGGBB.' });

  const exists = db.prepare('SELECT 1 FROM categorias WHERE nome = ? COLLATE NOCASE').get(nome);
  if (exists) return res.status(409).json({ error: 'Já existe uma categoria com esse nome.' });

  const result = db.prepare('INSERT INTO categorias (nome, cor) VALUES (?, ?)').run(nome, cor);
  res.status(201).json({ id: Number(result.lastInsertRowid), nome, cor });
});

router.delete('/:id', (req, res) => {
  const id  = Number(req.params.id);
  const cat = db.prepare('SELECT nome FROM categorias WHERE id = ?').get(id);
  if (!cat) return res.status(404).json({ error: 'Categoria não encontrada.' });

  const emUso =
    db.prepare('SELECT COUNT(*) AS n FROM transactions WHERE cat = ?').get(cat.nome).n +
    db.prepare('SELECT COUNT(*) AS n FROM recorrentes  WHERE cat = ?').get(cat.nome).n;
  if (emUso > 0) {
    return res.status(409).json({ error: `"${cat.nome}" está em uso por ${emUso} registro(s). Mude a categoria deles antes de excluir.` });
  }

  db.prepare('DELETE FROM categorias WHERE id = ?').run(id);
  res.json({ ok: true });
});

module.exports = router;
