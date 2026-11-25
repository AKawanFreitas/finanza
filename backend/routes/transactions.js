const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { exigirLogin } = require('../lib/auth');
const { paraReais }   = require('../lib/money');
const { SELECT, paraApi, filtros, inteiroPositivo } = require('../lib/transacoes');
const { transacao, validar } = require('../lib/schemas');
const { resolverCategoria }  = require('../lib/categorias');
const { resolverConta }      = require('../lib/contas');
const { aposLancamentos }    = require('../lib/orcamentos');
const { dividirParcelas, dataDaParcela } = require('../lib/parcelas');
const crypto = require('crypto');
const { avisoDeLimite } = require('../lib/cartoes');

// Junta o aviso de limite estourado à resposta, quando houver (a compra é salva do mesmo jeito).
const comAviso = (userId, contaId, corpo) => {
  const aviso = avisoDeLimite(userId, contaId);
  return aviso ? { ...corpo, aviso } : corpo;
};

router.use(exigirLogin);

const buscar = (id, userId) => {
  const r = db.prepare(`${SELECT} WHERE t.id = ? AND t.user_id = ?`).get(id, userId);
  return r ? paraApi(r) : null;
};

// Valida o corpo e resolve categoria e conta (sempre dentro das do usuário).
function preparar(req) {
  const { value, error } = validar(transacao, req.body);
  if (error) return { status: 400, error };
  const categoria = resolverCategoria(req.user.id, value);
  if (!categoria) return { status: 400, error: 'Categoria não encontrada.' };
  const conta_id = resolverConta(req.user.id, value.conta_id);
  if (!conta_id) return { status: 400, error: 'Conta não encontrada ou arquivada.' };
  return { dados: { ...value, categoria_id: categoria.id, conta_id } };
}

// GET /api/transactions?mes=&tipo=&categoria_id=&conta_id=&q=&pagina=1&limite=20
// Os totais valem para todo o filtro, não só para a página devolvida.
router.get('/', (req, res) => {
  const f = filtros(req.query, req.user.id);
  if (f.error) return res.status(400).json({ error: f.error });

  const limite = Math.min(inteiroPositivo(req.query.limite, 20), 100);
  let pagina = inteiroPositivo(req.query.pagina, 1);

  const totais = db.prepare(`
    SELECT COUNT(*) AS total,
           COALESCE(SUM(CASE WHEN t.tipo = 'entrada' THEN t.valor_centavos END), 0) AS entradas,
           COALESCE(SUM(CASE WHEN t.tipo = 'saida'   THEN t.valor_centavos END), 0) AS saidas
    FROM transactions t WHERE ${f.where}
  `).get(...f.args);

  const paginas = Math.max(1, Math.ceil(totais.total / limite));
  pagina = Math.min(pagina, paginas);

  const itens = db.prepare(`${SELECT} WHERE ${f.where} ORDER BY t.data DESC, t.id DESC LIMIT ? OFFSET ?`)
    .all(...f.args, limite, (pagina - 1) * limite).map(paraApi);

  res.json({
    itens, total: totais.total, pagina, paginas, limite,
    totais: {
      entradas: paraReais(totais.entradas),
      saidas:   paraReais(totais.saidas),
      saldo:    paraReais(totais.entradas - totais.saidas),
    },
  });
});

// Compra parcelada: N lançamentos (um por mês, cada um na fatura correspondente) que somam exatamente o total.
const inserirParcelas = db.transaction((userId, d) => {
  const grupo = crypto.randomUUID();
  const valores = dividirParcelas(d.valor, d.parcelas);
  const stmt = db.prepare(`
    INSERT INTO transactions (user_id, conta_id, descricao, valor_centavos, tipo, categoria_id, data, obs, grupo_parcelas, parcela_numero, parcela_total)
    VALUES (?, ?, ?, ?, 'saida', ?, ?, ?, ?, ?, ?)
  `);
  return valores.map((v, i) => {
    const sufixo = ` (${i + 1}/${d.parcelas})`;
    const data = dataDaParcela(d.data, i);
    const id = Number(stmt.run(userId, d.conta_id, d.desc.slice(0, 120 - sufixo.length) + sufixo, v, d.categoria_id, data, d.obs, grupo, i + 1, d.parcelas).lastInsertRowid);
    return { id, data };
  });
});

router.post('/', (req, res) => {
  const { dados, error, status } = preparar(req);
  if (error) return res.status(status).json({ error });

  if (dados.parcelas > 1) {
    const conta = db.prepare('SELECT tipo FROM contas WHERE id = ?').get(dados.conta_id);
    if (conta.tipo !== 'cartao' || dados.tipo !== 'saida') {
      return res.status(400).json({ error: 'Só é possível parcelar compras (saídas) em um cartão de crédito.' });
    }
    const criadas = inserirParcelas(req.user.id, dados);
    aposLancamentos(req.user.id, criadas.map(c => ({ tipo: 'saida', data: c.data, categoria_id: dados.categoria_id })));
    return res.status(201).json(comAviso(req.user.id, dados.conta_id, { ...buscar(criadas[0].id, req.user.id), parcelas_criadas: criadas.length }));
  }

  const r = db.prepare(`
    INSERT INTO transactions (user_id, conta_id, descricao, valor_centavos, tipo, categoria_id, data, obs)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.user.id, dados.conta_id, dados.desc, dados.valor, dados.tipo, dados.categoria_id, dados.data, dados.obs);
  aposLancamentos(req.user.id, [dados]);
  res.status(201).json(comAviso(req.user.id, dados.conta_id, buscar(Number(r.lastInsertRowid), req.user.id)));
});

router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  // O pagamento de uma conta a pagar é editado pela própria conta (desfazer e pagar de novo):
  // mudar o lançamento por fora deixaria a conta "paga" com outro valor, tipo ou data.
  if (db.prepare('SELECT 1 FROM contas_pagar WHERE transacao_id = ? AND user_id = ?').get(id, req.user.id)) {
    return res.status(409).json({ error: 'Este lançamento é o pagamento de uma conta a pagar. Desfaça o pagamento em Contas a pagar para editar.' });
  }
  const { dados, error, status } = preparar(req);
  if (error) return res.status(status).json({ error });
  if (dados.parcelas > 1) return res.status(400).json({ error: 'Não é possível parcelar um lançamento que já existe. Crie a compra parcelada de novo.' });

  const r = db.prepare(`
    UPDATE transactions SET conta_id = ?, descricao = ?, valor_centavos = ?, tipo = ?, categoria_id = ?, data = ?, obs = ?
    WHERE id = ? AND user_id = ?
  `).run(dados.conta_id, dados.desc, dados.valor, dados.tipo, dados.categoria_id, dados.data, dados.obs, id, req.user.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Lançamento não encontrado.' });
  aposLancamentos(req.user.id, [dados]);
  res.json(comAviso(req.user.id, dados.conta_id, buscar(id, req.user.id)));
});

// DELETE /api/transactions/:id            apaga só este lançamento
//        /api/transactions/:id?parcelas=todas     apaga todas as parcelas da compra
//        /api/transactions/:id?parcelas=futuras   apaga esta parcela e as seguintes
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const modo = req.query.parcelas;
  const t = db.prepare('SELECT grupo_parcelas, parcela_numero FROM transactions WHERE id = ? AND user_id = ?').get(id, req.user.id);

  if (t?.grupo_parcelas && (modo === 'todas' || modo === 'futuras')) {
    const r = db.prepare(`DELETE FROM transactions WHERE user_id = ? AND grupo_parcelas = ? ${modo === 'futuras' ? 'AND parcela_numero >= ?' : ''}`)
      .run(...[req.user.id, t.grupo_parcelas, ...(modo === 'futuras' ? [t.parcela_numero] : [])]);
    return res.json({ ok: true, removidos: r.changes });
  }

  db.prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?').run(id, req.user.id);
  res.json({ ok: true, removidos: t ? 1 : 0 });
});

module.exports = router;
