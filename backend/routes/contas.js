const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { exigirLogin } = require('../lib/auth');
const { paraReais }   = require('../lib/money');
const { conta: contaSchema, validar } = require('../lib/schemas');
const { listarContas, contaPadrao }   = require('../lib/contas');

router.use(exigirLogin);

const paraApi = c => ({
  id: c.id, nome: c.nome, tipo: c.tipo, cor: c.cor, arquivada: !!c.arquivada,
  saldo_inicial: paraReais(c.saldo_inicial_centavos),
  saldo: paraReais(c.saldo_centavos),
});

const nomeEmUso = (userId, nome, ignorarId = 0) =>
  !!db.prepare('SELECT 1 FROM contas WHERE user_id = ? AND nome = ? COLLATE NOCASE AND id != ?').get(userId, nome, ignorarId);

router.get('/', (req, res) => {
  contaPadrao(req.user.id); // garante ao menos uma
  res.json(listarContas(req.user.id).map(paraApi));
});

router.post('/', (req, res) => {
  const { value, error } = validar(contaSchema, req.body);
  if (error) return res.status(400).json({ error });
  if (nomeEmUso(req.user.id, value.nome)) return res.status(409).json({ error: 'Já existe uma conta com esse nome.' });

  const r = db.prepare(
    'INSERT INTO contas (user_id, nome, tipo, cor, saldo_inicial_centavos, criado_em) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(req.user.id, value.nome, value.tipo, value.cor, value.saldo_inicial, new Date().toISOString());
  res.status(201).json(paraApi(listarContas(req.user.id, { id: Number(r.lastInsertRowid) })[0]));
});

router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const { value, error } = validar(contaSchema, req.body);
  if (error) return res.status(400).json({ error });

  const atual = db.prepare('SELECT id, arquivada FROM contas WHERE id = ? AND user_id = ?').get(id, req.user.id);
  if (!atual) return res.status(404).json({ error: 'Conta não encontrada.' });
  if (nomeEmUso(req.user.id, value.nome, id)) return res.status(409).json({ error: 'Já existe uma conta com esse nome.' });

  const arquivar = value.arquivada === undefined ? !!atual.arquivada : value.arquivada;
  if (arquivar && !atual.arquivada) {
    const outras = db.prepare('SELECT COUNT(*) AS n FROM contas WHERE user_id = ? AND arquivada = 0 AND id != ?').get(req.user.id, id).n;
    if (outras === 0) return res.status(409).json({ error: 'Você precisa manter ao menos uma conta ativa.' });
  }

  db.prepare('UPDATE contas SET nome = ?, tipo = ?, cor = ?, saldo_inicial_centavos = ?, arquivada = ? WHERE id = ? AND user_id = ?')
    .run(value.nome, value.tipo, value.cor, value.saldo_inicial, arquivar ? 1 : 0, id, req.user.id);
  res.json(paraApi(listarContas(req.user.id, { id })[0]));
});

// Conta com histórico não é apagada (os lançamentos perderiam a origem): arquive.
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const conta = db.prepare('SELECT id, arquivada FROM contas WHERE id = ? AND user_id = ?').get(id, req.user.id);
  if (!conta) return res.status(404).json({ error: 'Conta não encontrada.' });

  const usos =
    db.prepare('SELECT COUNT(*) AS n FROM transactions WHERE conta_id = ?').get(id).n +
    db.prepare('SELECT COUNT(*) AS n FROM transferencias WHERE origem_id = ? OR destino_id = ?').get(id, id).n;
  if (usos > 0) {
    return res.status(409).json({ error: 'Esta conta tem movimentações. Arquive-a em vez de excluir.' });
  }
  const outras = db.prepare('SELECT COUNT(*) AS n FROM contas WHERE user_id = ? AND arquivada = 0 AND id != ?').get(req.user.id, id).n;
  if (!conta.arquivada && outras === 0) {
    return res.status(409).json({ error: 'Você precisa manter ao menos uma conta ativa.' });
  }

  db.prepare('DELETE FROM contas WHERE id = ? AND user_id = ?').run(id, req.user.id);
  res.json({ ok: true });
});

module.exports = router;
