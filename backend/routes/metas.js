const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { exigirLogin } = require('../lib/auth');
const { paraReais }   = require('../lib/money');
const { hojeBR }      = require('../lib/datas');
const { meta: metaSchema, aporte: aporteSchema, validar } = require('../lib/schemas');
const { listarMetas, avaliarMeta, saldoDaMeta } = require('../lib/metas');

router.use(exigirLogin);

const minhaMeta = (userId, id) => db.prepare('SELECT id, nome FROM metas WHERE id = ? AND user_id = ?').get(id, userId);
const nomeEmUso = (userId, nome, ignorarId = 0) =>
  !!db.prepare('SELECT 1 FROM metas WHERE user_id = ? AND nome = ? COLLATE NOCASE AND id != ?').get(userId, nome, ignorarId);

const aporteParaApi = a => ({ id: a.id, valor: paraReais(Math.abs(a.valor_centavos)), tipo: a.valor_centavos > 0 ? 'aporte' : 'retirada', data: a.data, obs: a.obs });

router.get('/', (req, res) => res.json(listarMetas(req.user.id)));

router.post('/', (req, res) => {
  const { value, error } = validar(metaSchema, req.body);
  if (error) return res.status(400).json({ error });
  if (nomeEmUso(req.user.id, value.nome)) return res.status(409).json({ error: 'Já existe uma meta com esse nome.' });

  const id = db.transaction(() => {
    const metaId = Number(db.prepare('INSERT INTO metas (user_id, nome, valor_alvo_centavos, prazo, cor, criado_em) VALUES (?, ?, ?, ?, ?, ?)')
      .run(req.user.id, value.nome, value.valor_alvo, value.prazo ?? null, value.cor, new Date().toISOString()).lastInsertRowid);
    if (value.valor_inicial) {
      db.prepare('INSERT INTO aportes (meta_id, user_id, valor_centavos, data, obs) VALUES (?, ?, ?, ?, ?)')
        .run(metaId, req.user.id, value.valor_inicial, hojeBR(), 'Valor inicial');
    }
    return metaId;
  })();
  avaliarMeta(req.user.id, id);
  res.status(201).json(listarMetas(req.user.id, { id })[0]);
});

router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const { value, error } = validar(metaSchema, req.body);
  if (error) return res.status(400).json({ error });
  const atual = db.prepare('SELECT arquivada FROM metas WHERE id = ? AND user_id = ?').get(id, req.user.id);
  if (!atual) return res.status(404).json({ error: 'Meta não encontrada.' });
  if (nomeEmUso(req.user.id, value.nome, id)) return res.status(409).json({ error: 'Já existe uma meta com esse nome.' });

  db.prepare('UPDATE metas SET nome = ?, valor_alvo_centavos = ?, prazo = ?, cor = ?, arquivada = ? WHERE id = ? AND user_id = ?')
    .run(value.nome, value.valor_alvo, value.prazo ?? null, value.cor, (value.arquivada ?? !!atual.arquivada) ? 1 : 0, id, req.user.id);
  avaliarMeta(req.user.id, id); // baixar o alvo pode ter concluído a meta
  res.json(listarMetas(req.user.id, { id })[0]);
});

router.delete('/:id', (req, res) => {
  const r = db.prepare('DELETE FROM metas WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.user.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Meta não encontrada.' });
  res.json({ ok: true });
});

/* ── Aportes e retiradas ────────────────────────────── */

router.get('/:id/aportes', (req, res) => {
  const meta = minhaMeta(req.user.id, Number(req.params.id));
  if (!meta) return res.status(404).json({ error: 'Meta não encontrada.' });
  res.json(db.prepare('SELECT * FROM aportes WHERE meta_id = ? ORDER BY data DESC, id DESC').all(meta.id).map(aporteParaApi));
});

router.post('/:id/aportes', (req, res) => {
  const meta = minhaMeta(req.user.id, Number(req.params.id));
  if (!meta) return res.status(404).json({ error: 'Meta não encontrada.' });
  const { value, error } = validar(aporteSchema, req.body);
  if (error) return res.status(400).json({ error });

  const assinado = value.tipo === 'retirada' ? -value.valor : value.valor;
  const criado = db.transaction(() => {
    if (assinado < 0 && saldoDaMeta(meta.id) + assinado < 0) return null;
    return Number(db.prepare('INSERT INTO aportes (meta_id, user_id, valor_centavos, data, obs) VALUES (?, ?, ?, ?, ?)')
      .run(meta.id, req.user.id, assinado, value.data ?? hojeBR(), value.obs).lastInsertRowid);
  })();
  if (criado === null) return res.status(400).json({ error: 'A retirada é maior que o valor guardado na meta.' });

  avaliarMeta(req.user.id, meta.id);
  res.status(201).json({ aporte: aporteParaApi(db.prepare('SELECT * FROM aportes WHERE id = ?').get(criado)), meta: listarMetas(req.user.id, { id: meta.id })[0] });
});

// Remover um aporte antigo não pode deixar a meta com saldo negativo (por causa de retiradas posteriores).
router.delete('/:id/aportes/:aporteId', (req, res) => {
  const meta = minhaMeta(req.user.id, Number(req.params.id));
  if (!meta) return res.status(404).json({ error: 'Meta não encontrada.' });
  const a = db.prepare('SELECT id, valor_centavos FROM aportes WHERE id = ? AND meta_id = ?').get(Number(req.params.aporteId), meta.id);
  if (!a) return res.status(404).json({ error: 'Aporte não encontrado.' });

  const removido = db.transaction(() => {
    if (saldoDaMeta(meta.id) - a.valor_centavos < 0) return false;
    db.prepare('DELETE FROM aportes WHERE id = ?').run(a.id);
    return true;
  })();
  if (!removido) return res.status(409).json({ error: 'Não dá para remover: a meta ficaria com saldo negativo por causa das retiradas.' });
  res.json({ ok: true, meta: listarMetas(req.user.id, { id: meta.id })[0] });
});

module.exports = router;
