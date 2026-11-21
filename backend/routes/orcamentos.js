const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { exigirLogin } = require('../lib/auth');
const { mesValido, mesAtual } = require('../lib/datas');
const { orcamento, validar }  = require('../lib/schemas');
const { listarOrcamentos, buscarOrcamento, avaliarOrcamento } = require('../lib/orcamentos');

router.use(exigirLogin);

const minhaCategoria = (userId, id) => db.prepare('SELECT id FROM categorias WHERE id = ? AND user_id = ?').get(id, userId);

// GET /api/orcamentos?mes=AAAA-MM  (padrão: mês atual). O limite é o mesmo todo mês.
router.get('/', (req, res) => {
  const mes = req.query.mes ?? mesAtual();
  if (!mesValido(mes)) return res.status(400).json({ error: 'O mês deve estar no formato AAAA-MM.' });
  const itens = listarOrcamentos(req.user.id, mes);
  const limite = itens.reduce((a, i) => a + i.limite, 0);
  const gasto  = itens.reduce((a, i) => a + i.gasto, 0);
  res.json({ mes, itens, totais: { limite: Math.round(limite * 100) / 100, gasto: Math.round(gasto * 100) / 100 } });
});

// Cria ou altera o limite de uma categoria. PUT /api/orcamentos/:categoriaId  { limite }
router.put('/:categoriaId', (req, res) => {
  const categoriaId = Number(req.params.categoriaId);
  const { value, error } = validar(orcamento, req.body);
  if (error) return res.status(400).json({ error });
  if (!minhaCategoria(req.user.id, categoriaId)) return res.status(404).json({ error: 'Categoria não encontrada.' });

  db.prepare(`
    INSERT INTO orcamentos (user_id, categoria_id, valor_centavos) VALUES (?, ?, ?)
    ON CONFLICT (user_id, categoria_id) DO UPDATE SET valor_centavos = excluded.valor_centavos
  `).run(req.user.id, categoriaId, value.limite);

  const mes = mesAtual();
  avaliarOrcamento(req.user.id, categoriaId, mes); // limite novo pode já estar ultrapassado
  res.json(buscarOrcamento(req.user.id, categoriaId, mes));
});

router.delete('/:categoriaId', (req, res) => {
  const r = db.prepare('DELETE FROM orcamentos WHERE user_id = ? AND categoria_id = ?').run(req.user.id, Number(req.params.categoriaId));
  if (r.changes === 0) return res.status(404).json({ error: 'Orçamento não encontrado.' });
  res.json({ ok: true });
});

module.exports = router;
