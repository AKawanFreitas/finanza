const express = require('express');
const router  = express.Router();
const db      = require('../db');

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM recorrentes ORDER BY dia ASC').all());
});

router.post('/', (req, res) => {
  const { nome, valor, tipo, cat, dia, obs = '' } = req.body;
  const result = db.prepare(
    'INSERT INTO recorrentes (nome, valor, tipo, cat, dia, obs) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(nome, valor, tipo, cat, dia, obs);
  res.status(201).json({ id: result.lastInsertRowid, nome, valor, tipo, cat, dia, obs });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM recorrentes WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

module.exports = router;
