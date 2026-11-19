const express = require('express');
const router  = express.Router();
const db      = require('../db');

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM transactions ORDER BY data DESC').all());
});

router.post('/', (req, res) => {
  const { desc, valor, tipo, cat, data, obs = '' } = req.body;
  const result = db.prepare(
    'INSERT INTO transactions (desc, valor, tipo, cat, data, obs) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(desc, valor, tipo, cat, data, obs);
  res.status(201).json({ id: result.lastInsertRowid, desc, valor, tipo, cat, data, obs });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM transactions WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

module.exports = router;
