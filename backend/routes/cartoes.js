const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { exigirLogin } = require('../lib/auth');
const { mesValido, hojeBR } = require('../lib/datas');
const { cartao: cartaoSchema, pagamentoFatura, validar } = require('../lib/schemas');
const { FATURA_SQL, buscarCartao, listarFaturas, buscarFatura, resumoDoCartao } = require('../lib/cartoes');
const { SELECT, paraApi: txParaApi } = require('../lib/transacoes');
const { excluirConta } = require('../lib/contas');

router.use(exigirLogin);

const nomeEmUso = (userId, nome, ignorarId = 0) =>
  !!db.prepare('SELECT 1 FROM contas WHERE user_id = ? AND nome = ? COLLATE NOCASE AND id != ?').get(userId, nome, ignorarId);

// Conta que paga a fatura: do usuário, ativa e que não seja um cartão.
const contaDePagamento = (userId, id) =>
  db.prepare("SELECT id FROM contas WHERE id = ? AND user_id = ? AND arquivada = 0 AND tipo <> 'cartao'").get(id, userId);

function doRequest(req, res) {
  const cartao = buscarCartao(req.user.id, Number(req.params.id));
  if (!cartao) { res.status(404).json({ error: 'Cartão não encontrado.' }); return null; }
  return cartao;
}

router.get('/', (req, res) => {
  const ids = db.prepare("SELECT id FROM contas WHERE user_id = ? AND tipo = 'cartao' ORDER BY arquivada, id").all(req.user.id);
  res.json(ids.map(({ id }) => resumoDoCartao(req.user.id, buscarCartao(req.user.id, id))));
});

router.post('/', (req, res) => {
  const { value, error } = validar(cartaoSchema, req.body);
  if (error) return res.status(400).json({ error });
  if (nomeEmUso(req.user.id, value.nome)) return res.status(409).json({ error: 'Já existe uma conta ou cartão com esse nome.' });
  if (value.conta_pagamento_id && !contaDePagamento(req.user.id, value.conta_pagamento_id)) {
    return res.status(400).json({ error: 'Conta de pagamento não encontrada ou arquivada.' });
  }

  const id = db.transaction(() => {
    const contaId = Number(db.prepare(
      "INSERT INTO contas (user_id, nome, tipo, cor, saldo_inicial_centavos, criado_em) VALUES (?, ?, 'cartao', ?, ?, ?)"
    ).run(req.user.id, value.nome, value.cor, -value.divida_inicial, new Date().toISOString()).lastInsertRowid);
    db.prepare('INSERT INTO cartoes (conta_id, limite_centavos, dia_fechamento, dia_vencimento, conta_pagamento_id) VALUES (?, ?, ?, ?, ?)')
      .run(contaId, value.limite, value.dia_fechamento, value.dia_vencimento, value.conta_pagamento_id ?? null);
    return contaId;
  })();
  res.status(201).json(resumoDoCartao(req.user.id, buscarCartao(req.user.id, id)));
});

router.put('/:id', (req, res) => {
  const cartao = doRequest(req, res);
  if (!cartao) return;
  const { value, error } = validar(cartaoSchema, req.body);
  if (error) return res.status(400).json({ error });
  if (nomeEmUso(req.user.id, value.nome, cartao.id)) return res.status(409).json({ error: 'Já existe uma conta ou cartão com esse nome.' });
  if (value.conta_pagamento_id && !contaDePagamento(req.user.id, value.conta_pagamento_id)) {
    return res.status(400).json({ error: 'Conta de pagamento não encontrada ou arquivada.' });
  }

  db.transaction(() => {
    db.prepare('UPDATE contas SET nome = ?, cor = ?, arquivada = ? WHERE id = ?')
      .run(value.nome, value.cor, (value.arquivada ?? !!cartao.arquivada) ? 1 : 0, cartao.id);
    db.prepare('UPDATE cartoes SET limite_centavos = ?, dia_fechamento = ?, dia_vencimento = ?, conta_pagamento_id = ? WHERE conta_id = ?')
      .run(value.limite, value.dia_fechamento, value.dia_vencimento, value.conta_pagamento_id ?? null, cartao.id);
  })();
  res.json(resumoDoCartao(req.user.id, buscarCartao(req.user.id, cartao.id)));
});

// Cartão com compras ou pagamentos não é apagado (o histórico perderia a origem): arquive.
router.delete('/:id', (req, res) => {
  const cartao = doRequest(req, res);
  if (!cartao) return;
  const usos =
    db.prepare('SELECT COUNT(*) AS n FROM transactions WHERE conta_id = ?').get(cartao.id).n +
    db.prepare('SELECT COUNT(*) AS n FROM transferencias WHERE origem_id = ? OR destino_id = ?').get(cartao.id, cartao.id).n;
  if (usos > 0) return res.status(409).json({ error: 'Este cartão tem movimentações. Arquive-o em vez de excluir.' });
  excluirConta(cartao.id);
  res.json({ ok: true });
});

/* ── Faturas ────────────────────────────────────────── */

router.get('/:id/faturas', (req, res) => {
  const cartao = doRequest(req, res);
  if (!cartao) return;
  res.json(listarFaturas(cartao));
});

// Uma fatura com os lançamentos que a compõem.
router.get('/:id/faturas/:mes', (req, res) => {
  const cartao = doRequest(req, res);
  if (!cartao) return;
  if (!mesValido(req.params.mes)) return res.status(400).json({ error: 'O mês deve estar no formato AAAA-MM.' });

  const fatura = buscarFatura(cartao, req.params.mes);
  const itens = db.prepare(`${SELECT} WHERE t.user_id = ? AND t.conta_id = ? AND (${FATURA_SQL}) = ? ORDER BY t.data DESC, t.id DESC`)
    .all(req.user.id, cartao.id, req.params.mes).map(txParaApi);
  const pagamentos = db.prepare(`
    SELECT t.id, t.data, t.valor_centavos / 100.0 AS valor, o.nome AS origem
    FROM transferencias t JOIN contas o ON o.id = t.origem_id
    WHERE t.destino_id = ? AND t.fatura_ref = ? ORDER BY t.data, t.id
  `).all(cartao.id, req.params.mes);
  res.json({ ...fatura, lancamentos: itens, pagamentos });
});

// Paga a fatura (ou parte dela) com uma transferência de outra conta para o cartão.
// Não é gasto: o gasto já foi contado na compra. Só desloca o dinheiro e abate a dívida.
router.post('/:id/faturas/:mes/pagar', (req, res) => {
  const cartao = doRequest(req, res);
  if (!cartao) return;
  if (!mesValido(req.params.mes)) return res.status(400).json({ error: 'O mês deve estar no formato AAAA-MM.' });
  const { value, error } = validar(pagamentoFatura, req.body);
  if (error) return res.status(400).json({ error });
  if (!contaDePagamento(req.user.id, value.origem_id)) {
    return res.status(400).json({ error: 'Conta de pagamento não encontrada, arquivada ou é um cartão.' });
  }

  const fatura = buscarFatura(cartao, req.params.mes);
  const restante = Math.round(fatura.restante * 100);
  if (restante <= 0) return res.status(409).json({ error: 'Esta fatura não tem valor a pagar.' });
  const valor = value.valor ?? restante;
  if (valor > restante) return res.status(400).json({ error: 'O pagamento é maior que o restante da fatura.' });

  db.prepare(`
    INSERT INTO transferencias (user_id, origem_id, destino_id, valor_centavos, data, descricao, fatura_ref)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(req.user.id, value.origem_id, cartao.id, valor, value.data ?? hojeBR(), `Fatura ${req.params.mes} · ${cartao.nome}`, req.params.mes);

  res.status(201).json({ fatura: buscarFatura(cartao, req.params.mes), cartao: resumoDoCartao(req.user.id, buscarCartao(req.user.id, cartao.id)) });
});

module.exports = router;
