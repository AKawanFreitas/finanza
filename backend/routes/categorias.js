const express = require('express');
const router  = express.Router();
const db      = require('../db');

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM categorias ORDER BY nome ASC').all());
});

router.post('/', (req, res) => {
  const { nome, cor } = req.body;
  const result = db.prepare('INSERT INTO categorias (nome, cor) VALUES (?, ?)').run(nome, cor);
  res.status(201).json({ id: result.lastInsertRowid, nome, cor });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM categorias WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

module.exports = router;
