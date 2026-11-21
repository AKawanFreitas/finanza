const express = require('express');
const router  = express.Router();
const { exigirLogin } = require('../lib/auth');
const { mesValido, mesAtual } = require('../lib/datas');
const { calcularResumo } = require('../lib/resumo');
const { listarOrcamentos } = require('../lib/orcamentos');

router.use(exigirLogin);

// GET /api/resumo?mes=AAAA-MM  (padrão: mês atual)
router.get('/', (req, res) => {
  const mes = req.query.mes ?? mesAtual();
  if (!mesValido(mes)) return res.status(400).json({ error: 'O mês deve estar no formato AAAA-MM.' });
  res.json({ ...calcularResumo(req.user.id, mes), orcamentos: listarOrcamentos(req.user.id, mes) });
});

module.exports = router;
