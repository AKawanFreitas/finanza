const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { exigirLogin } = require('../lib/auth');

router.use(exigirLogin);

function parseRecorrente(body = {}) {
  const nome  = typeof body.nome === 'string' ? body.nome.trim() : '';
  const cat   = typeof body.cat  === 'string' ? body.cat.trim()  : '';
  const valor = Number(body.valor);
  const dia   = Number(body.dia);
  const { tipo } = body;
  const obs   = typeof body.obs === 'string' ? body.obs : '';

  if (!nome)                                 return { error: 'Informe o nome.' };
  if (!Number.isFinite(valor) || valor <= 0) return { error: 'O valor deve ser maior que zero.' };
  if (tipo !== 'fixo' && tipo !== 'recorrente') return { error: 'O tipo deve ser "fixo" ou "recorrente".' };
  if (!cat)                                  return { error: 'Informe a categoria.' };
  if (!Number.isInteger(dia) || dia < 1 || dia > 31) return { error: 'O dia do vencimento deve estar entre 1 e 31.' };

  return { value: { nome, valor, tipo, cat, dia, obs } };
}

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM recorrentes WHERE user_id = ? ORDER BY dia ASC').all(req.user.id));
});

router.post('/', (req, res) => {
  const { value, error } = parseRecorrente(req.body);
  if (error) return res.status(400).json({ error });

  const { nome, valor, tipo, cat, dia, obs } = value;
  const result = db.prepare(
    'INSERT INTO recorrentes (user_id, nome, valor, tipo, cat, dia, obs) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(req.user.id, nome, valor, tipo, cat, dia, obs);
  res.status(201).json({ id: Number(result.lastInsertRowid), ...value });
});

router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const { value, error } = parseRecorrente(req.body);
  if (error) return res.status(400).json({ error });

  const { nome, valor, tipo, cat, dia, obs } = value;
  const result = db.prepare(
    'UPDATE recorrentes SET nome = ?, valor = ?, tipo = ?, cat = ?, dia = ?, obs = ? WHERE id = ? AND user_id = ?'
  ).run(nome, valor, tipo, cat, dia, obs, id, req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Recorrente não encontrado.' });
  res.json({ id, ...value });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM recorrentes WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.user.id);
  res.json({ ok: true });
});

module.exports = router;
