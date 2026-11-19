const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { exigirLogin } = require('../lib/auth');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

router.use(exigirLogin);

function parseTransaction(body = {}) {
  const desc  = typeof body.desc === 'string' ? body.desc.trim() : '';
  const cat   = typeof body.cat  === 'string' ? body.cat.trim()  : '';
  const valor = Number(body.valor);
  const { tipo, data } = body;
  const obs   = typeof body.obs === 'string' ? body.obs : '';

  if (!desc)                                 return { error: 'Informe a descrição.' };
  if (!Number.isFinite(valor) || valor <= 0) return { error: 'O valor deve ser maior que zero.' };
  if (tipo !== 'entrada' && tipo !== 'saida') return { error: 'O tipo deve ser "entrada" ou "saida".' };
  if (!cat)                                  return { error: 'Informe a categoria.' };
  if (!DATE_RE.test(data || ''))             return { error: 'A data deve estar no formato AAAA-MM-DD.' };

  return { value: { desc, valor, tipo, cat, data, obs } };
}

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY data DESC').all(req.user.id));
});

router.post('/', (req, res) => {
  const { value, error } = parseTransaction(req.body);
  if (error) return res.status(400).json({ error });

  const { desc, valor, tipo, cat, data, obs } = value;
  const result = db.prepare(
    'INSERT INTO transactions (user_id, desc, valor, tipo, cat, data, obs) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(req.user.id, desc, valor, tipo, cat, data, obs);
  res.status(201).json({ id: Number(result.lastInsertRowid), ...value });
});

router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const { value, error } = parseTransaction(req.body);
  if (error) return res.status(400).json({ error });

  const { desc, valor, tipo, cat, data, obs } = value;
  const result = db.prepare(
    'UPDATE transactions SET desc = ?, valor = ?, tipo = ?, cat = ?, data = ?, obs = ? WHERE id = ? AND user_id = ?'
  ).run(desc, valor, tipo, cat, data, obs, id, req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Lançamento não encontrado.' });
  res.json({ id, ...value });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.user.id);
  res.json({ ok: true });
});

module.exports = router;
