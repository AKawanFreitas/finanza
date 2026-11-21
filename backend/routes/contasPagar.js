const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { exigirLogin } = require('../lib/auth');
const { mesValido }   = require('../lib/datas');
const { contaPagar, pagarConta, validar } = require('../lib/schemas');
const { resolverCategoria } = require('../lib/categorias');
const { resolverConta }     = require('../lib/contas');
const { aposLancamentos }   = require('../lib/orcamentos');
const { listar, buscar, totais } = require('../lib/contasPagar');
const { hojeBR } = require('../lib/datas');

router.use(exigirLogin);

const STATUS = new Set(['todas', 'abertas', 'pendente', 'atrasada', 'paga']);

// GET /api/contas-pagar?status=todas|abertas|pendente|atrasada|paga&mes=AAAA-MM
router.get('/', (req, res) => {
  const status = req.query.status ?? 'todas';
  if (!STATUS.has(status)) return res.status(400).json({ error: 'Status inválido.' });
  const mes = req.query.mes || undefined;
  if (mes && !mesValido(mes)) return res.status(400).json({ error: 'O mês deve estar no formato AAAA-MM.' });
  res.json({ itens: listar(req.user.id, { status, mes }), totais: totais(req.user.id) });
});

// Valida o corpo, a categoria e a conta planejada (opcional). Devolve { dados } ou { status, error }.
function preparar(req) {
  const { value, error } = validar(contaPagar, req.body);
  if (error) return { status: 400, error };
  const categoria = resolverCategoria(req.user.id, value);
  if (!categoria) return { status: 400, error: 'Categoria não encontrada.' };
  let conta_id = null;
  if (value.conta_id !== undefined) {
    conta_id = resolverConta(req.user.id, value.conta_id);
    if (!conta_id) return { status: 400, error: 'Conta não encontrada ou arquivada.' };
  }
  return { dados: { ...value, categoria_id: categoria.id, conta_id } };
}

router.post('/', (req, res) => {
  const { dados, error, status } = preparar(req);
  if (error) return res.status(status).json({ error });
  const r = db.prepare(`
    INSERT INTO contas_pagar (user_id, descricao, valor_centavos, vencimento, categoria_id, conta_id, obs, criado_em)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.user.id, dados.descricao, dados.valor, dados.vencimento, dados.categoria_id, dados.conta_id, dados.obs, new Date().toISOString());
  res.status(201).json(buscar(Number(r.lastInsertRowid), req.user.id));
});

router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const atual = db.prepare('SELECT transacao_id FROM contas_pagar WHERE id = ? AND user_id = ?').get(id, req.user.id);
  if (!atual) return res.status(404).json({ error: 'Conta a pagar não encontrada.' });
  if (atual.transacao_id) return res.status(409).json({ error: 'Esta conta já foi paga. Desfaça o pagamento para editar.' });

  const { dados, error, status } = preparar(req);
  if (error) return res.status(status).json({ error });
  db.prepare(`
    UPDATE contas_pagar SET descricao = ?, valor_centavos = ?, vencimento = ?, categoria_id = ?, conta_id = ?, obs = ?
    WHERE id = ? AND user_id = ?
  `).run(dados.descricao, dados.valor, dados.vencimento, dados.categoria_id, dados.conta_id, dados.obs, id, req.user.id);
  res.json(buscar(id, req.user.id));
});

// Excluir a conta não apaga o lançamento que o pagamento gerou (o gasto aconteceu).
router.delete('/:id', (req, res) => {
  const r = db.prepare('DELETE FROM contas_pagar WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.user.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Conta a pagar não encontrada.' });
  res.json({ ok: true });
});

// Pagar = criar a saída e vincular. Conta usada: a informada, senão a planejada, senão a principal.
const pagar = db.transaction((userId, cp, contaId, data) => {
  const txId = Number(db.prepare(`
    INSERT INTO transactions (user_id, conta_id, descricao, valor_centavos, tipo, categoria_id, data, obs)
    VALUES (?, ?, ?, ?, 'saida', ?, ?, ?)
  `).run(userId, contaId, cp.descricao, cp.valor_centavos, cp.categoria_id, data, cp.obs).lastInsertRowid);
  db.prepare('UPDATE contas_pagar SET transacao_id = ? WHERE id = ?').run(txId, cp.id);
  return txId;
});

router.post('/:id/pagar', (req, res) => {
  const id = Number(req.params.id);
  const cp = db.prepare('SELECT * FROM contas_pagar WHERE id = ? AND user_id = ?').get(id, req.user.id);
  if (!cp) return res.status(404).json({ error: 'Conta a pagar não encontrada.' });
  if (cp.transacao_id) return res.status(409).json({ error: 'Esta conta já foi paga.' });

  const { value, error } = validar(pagarConta, req.body);
  if (error) return res.status(400).json({ error });
  const contaId = resolverConta(req.user.id, value.conta_id ?? cp.conta_id ?? undefined);
  if (!contaId) return res.status(400).json({ error: 'Conta não encontrada ou arquivada.' });

  const data = value.data ?? hojeBR();
  pagar(req.user.id, cp, contaId, data);
  aposLancamentos(req.user.id, [{ tipo: 'saida', data, categoria_id: cp.categoria_id }]);
  res.json(buscar(id, req.user.id));
});

// Desfaz o pagamento: apaga o lançamento gerado e a conta volta a ficar em aberto.
router.post('/:id/desfazer', (req, res) => {
  const id = Number(req.params.id);
  const cp = db.prepare('SELECT transacao_id FROM contas_pagar WHERE id = ? AND user_id = ?').get(id, req.user.id);
  if (!cp) return res.status(404).json({ error: 'Conta a pagar não encontrada.' });
  if (!cp.transacao_id) return res.status(409).json({ error: 'Esta conta ainda não foi paga.' });
  // ON DELETE SET NULL desvincula sozinho.
  db.prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?').run(cp.transacao_id, req.user.id);
  res.json(buscar(id, req.user.id));
});

module.exports = router;
