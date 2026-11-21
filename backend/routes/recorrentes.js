const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { exigirLogin } = require('../lib/auth');
const { paraReais }   = require('../lib/money');
const { mesValido, mesAtual, dataVencimento } = require('../lib/datas');
const { recorrente, validar } = require('../lib/schemas');
const { resolverCategoria }   = require('../lib/categorias');
const { resolverConta }       = require('../lib/contas');
const { SELECT: SELECT_TX, paraApi: txParaApi } = require('../lib/transacoes');
const { lancarUm } = require('../lib/recorrentes');
const { aposLancamentos } = require('../lib/orcamentos');

router.use(exigirLogin);

// `lancado`: já existe um lançamento gerado por este recorrente no mês pedido.
const SELECT = `
  SELECT r.id, r.nome, r.valor_centavos, r.tipo, r.categoria_id, c.nome AS cat, r.dia, r.obs, r.automatico, r.conta_id,
         EXISTS (SELECT 1 FROM transactions t WHERE t.recorrente_id = r.id AND substr(t.data, 1, 7) = :mes) AS lancado
  FROM recorrentes r JOIN categorias c ON c.id = r.categoria_id
`;

const paraApi = r => ({
  id: r.id, nome: r.nome, valor: paraReais(r.valor_centavos), tipo: r.tipo,
  cat: r.cat, categoria_id: r.categoria_id, dia: r.dia, obs: r.obs, lancado: !!r.lancado,
  automatico: !!r.automatico, conta_id: r.conta_id,
});

const buscar = (id, userId, mes = mesAtual()) => {
  const r = db.prepare(`${SELECT} WHERE r.id = :id AND r.user_id = :uid`).get({ id, uid: userId, mes });
  return r ? paraApi(r) : null;
};

function preparar(req) {
  const { value, error } = validar(recorrente, req.body);
  if (error) return { status: 400, error };
  const categoria = resolverCategoria(req.user.id, value);
  if (!categoria) return { status: 400, error: 'Categoria não encontrada.' };
  // conta_id é opcional: sem ele, o lançamento automático usa a conta principal na hora de lançar.
  let conta_id = null;
  if (value.conta_id !== undefined) {
    conta_id = resolverConta(req.user.id, value.conta_id);
    if (!conta_id) return { status: 400, error: 'Conta não encontrada ou arquivada.' };
  }
  return { dados: { ...value, categoria_id: categoria.id, conta_id } };
}

const lerMes = req => {
  const mes = req.query?.mes ?? req.body?.mes ?? mesAtual();
  return mesValido(mes) ? mes : null;
};

// GET /api/recorrentes?mes=AAAA-MM  (o campo `lancado` vale para esse mês)
router.get('/', (req, res) => {
  const mes = lerMes(req);
  if (!mes) return res.status(400).json({ error: 'O mês deve estar no formato AAAA-MM.' });
  res.json(db.prepare(`${SELECT} WHERE r.user_id = :uid ORDER BY r.dia ASC, r.id ASC`)
    .all({ uid: req.user.id, mes }).map(paraApi));
});

router.post('/', (req, res) => {
  const { dados, error, status } = preparar(req);
  if (error) return res.status(status).json({ error });

  const r = db.prepare(
    'INSERT INTO recorrentes (user_id, nome, valor_centavos, tipo, categoria_id, dia, obs, automatico, conta_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(req.user.id, dados.nome, dados.valor, dados.tipo, dados.categoria_id, dados.dia, dados.obs, dados.automatico ? 1 : 0, dados.conta_id);
  res.status(201).json(buscar(Number(r.lastInsertRowid), req.user.id));
});

router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const { dados, error, status } = preparar(req);
  if (error) return res.status(status).json({ error });

  const r = db.prepare(
    'UPDATE recorrentes SET nome = ?, valor_centavos = ?, tipo = ?, categoria_id = ?, dia = ?, obs = ?, automatico = ?, conta_id = ? WHERE id = ? AND user_id = ?'
  ).run(dados.nome, dados.valor, dados.tipo, dados.categoria_id, dados.dia, dados.obs, dados.automatico ? 1 : 0, dados.conta_id, id, req.user.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Recorrente não encontrado.' });
  res.json(buscar(id, req.user.id));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM recorrentes WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.user.id);
  res.json({ ok: true });
});

/* ── Lançar no mês, sem duplicar ───────────────────── */

function contaDaRequisicao(req) {
  const id = req.body?.conta_id;
  if (id !== undefined && !Number.isInteger(id)) return { error: 'Conta inválida.' };
  const contaId = resolverConta(req.user.id, id);
  return contaId ? { contaId } : { error: 'Conta não encontrada ou arquivada.' };
}

// POST /api/recorrentes/lancar-pendentes  { mes?, conta_id? }
router.post('/lancar-pendentes', (req, res) => {
  const mes = lerMes(req);
  if (!mes) return res.status(400).json({ error: 'O mês deve estar no formato AAAA-MM.' });
  const { contaId, error } = contaDaRequisicao(req);
  if (error) return res.status(400).json({ error });

  const todos = db.prepare('SELECT * FROM recorrentes WHERE user_id = ? ORDER BY dia, id').all(req.user.id);
  const criados = [];
  for (const rec of todos) {
    const id = lancarUm(req.user.id, rec, mes, contaId);
    if (id) criados.push(txParaApi(db.prepare(`${SELECT_TX} WHERE t.id = ?`).get(id)));
  }
  aposLancamentos(req.user.id, criados);
  res.json({ lancados: criados.length, itens: criados });
});

// POST /api/recorrentes/:id/lancar  { mes?, conta_id? }
router.post('/:id/lancar', (req, res) => {
  const mes = lerMes(req);
  if (!mes) return res.status(400).json({ error: 'O mês deve estar no formato AAAA-MM.' });
  const { contaId, error } = contaDaRequisicao(req);
  if (error) return res.status(400).json({ error });

  const rec = db.prepare('SELECT * FROM recorrentes WHERE id = ? AND user_id = ?').get(Number(req.params.id), req.user.id);
  if (!rec) return res.status(404).json({ error: 'Recorrente não encontrado.' });

  const id = lancarUm(req.user.id, rec, mes, contaId);
  if (!id) return res.status(409).json({ error: 'Este recorrente já foi lançado neste mês.' });
  const criado = txParaApi(db.prepare(`${SELECT_TX} WHERE t.id = ?`).get(id));
  aposLancamentos(req.user.id, [criado]);
  res.status(201).json(criado);
});

module.exports = router;
