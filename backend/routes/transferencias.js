const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { exigirLogin } = require('../lib/auth');
const { paraReais }   = require('../lib/money');
const { transferencia, validar } = require('../lib/schemas');

router.use(exigirLogin);

const SELECT = `
  SELECT t.id, t.origem_id, o.nome AS origem, t.destino_id, d.nome AS destino,
         t.valor_centavos, t.data, t.descricao
  FROM transferencias t
  JOIN contas o ON o.id = t.origem_id
  JOIN contas d ON d.id = t.destino_id
`;

const paraApi = r => ({
  id: r.id, origem_id: r.origem_id, origem: r.origem, destino_id: r.destino_id, destino: r.destino,
  valor: paraReais(r.valor_centavos), data: r.data, descricao: r.descricao,
});

router.get('/', (req, res) => {
  const limite = Math.min(Number.parseInt(req.query.limite, 10) || 20, 100);
  res.json(db.prepare(`${SELECT} WHERE t.user_id = ? ORDER BY t.data DESC, t.id DESC LIMIT ?`)
    .all(req.user.id, limite).map(paraApi));
});

router.post('/', (req, res) => {
  const { value, error } = validar(transferencia, req.body);
  if (error) return res.status(400).json({ error });

  const ativa = id => db.prepare('SELECT tipo FROM contas WHERE id = ? AND user_id = ? AND arquivada = 0').get(id, req.user.id);
  const origem = ativa(value.origem_id);
  const destino = ativa(value.destino_id);
  if (!origem)  return res.status(400).json({ error: 'Conta de origem não encontrada ou arquivada.' });
  if (!destino) return res.status(400).json({ error: 'Conta de destino não encontrada ou arquivada.' });
  // Dinheiro que entra no cartão é pagamento de fatura (fica ligado ao mês certo); por transferência comum,
  // abateria a dívida sem a fatura saber e ela continuaria "vencida".
  if (origem.tipo === 'cartao' || destino.tipo === 'cartao') {
    return res.status(400).json({ error: 'Cartão de crédito não entra em transferência. Para pagar, use Pagar fatura na tela de Cartões.' });
  }

  const r = db.prepare(
    'INSERT INTO transferencias (user_id, origem_id, destino_id, valor_centavos, data, descricao) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(req.user.id, value.origem_id, value.destino_id, value.valor, value.data, value.descricao);
  res.status(201).json(paraApi(db.prepare(`${SELECT} WHERE t.id = ?`).get(Number(r.lastInsertRowid))));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM transferencias WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.user.id);
  res.json({ ok: true });
});

module.exports = router;
