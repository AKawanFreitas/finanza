const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { exigirLogin } = require('../lib/auth');
const { paraReais, paraCentavos } = require('../lib/money');
const { dataValida } = require('../lib/datas');
const { resolverConta } = require('../lib/contas');
const { aposLancamentos } = require('../lib/orcamentos');
const { lerArquivo, atribuirIds, sugerirCategorias, marcarDuplicadas, MAX_LINHAS } = require('../lib/importacao');

router.use(exigirLogin);

function contaDoCorpo(req) {
  const id = req.body?.conta_id;
  if (!Number.isInteger(id)) return null;
  return resolverConta(req.user.id, id);
}

// Passo 1: lê o arquivo e mostra o que seria importado, sem gravar nada.
// POST /api/importacao/previa  { conta_id, conteudo, formato?: 'auto' | 'ofx' | 'csv' }
router.post('/previa', (req, res) => {
  const contaId = contaDoCorpo(req);
  if (!contaId) return res.status(400).json({ error: 'Escolha a conta que receberá os lançamentos.' });

  let lido;
  try { lido = lerArquivo(req.body?.conteudo, req.body?.formato); }
  catch (e) { return res.status(400).json({ error: e.message }); }

  const itens = marcarDuplicadas(contaId, sugerirCategorias(req.user.id, atribuirIds(lido.itens)));
  res.json({
    formato: lido.formato,
    ignoradas: lido.ignoradas,
    itens: itens.map(i => ({
      externo: i.externo, data: i.data, desc: i.desc, obs: i.obs, tipo: i.tipo,
      valor: paraReais(i.valor_centavos), categoria_id: i.categoria_id, duplicada: i.duplicada,
    })),
  });
});

const inserir = db.transaction((userId, contaId, itens) => {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO transactions (user_id, conta_id, descricao, valor_centavos, tipo, categoria_id, data, obs, id_externo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  let importados = 0;
  for (const i of itens) {
    importados += stmt.run(userId, contaId, i.desc, i.valor_centavos, i.tipo, i.categoria_id, i.data, i.obs, i.externo).changes;
  }
  return importados;
});

// Passo 2: grava os itens escolhidos (já com a categoria que a pessoa definiu).
// Itens cujo id já existe na conta são ignorados, então confirmar duas vezes não duplica.
// POST /api/importacao/confirmar  { conta_id, itens: [{ externo, data, desc, valor, tipo, categoria_id, obs? }] }
router.post('/confirmar', (req, res) => {
  const contaId = contaDoCorpo(req);
  if (!contaId) return res.status(400).json({ error: 'Escolha a conta que receberá os lançamentos.' });

  const brutos = req.body?.itens;
  if (!Array.isArray(brutos) || brutos.length === 0) return res.status(400).json({ error: 'Nenhum lançamento selecionado.' });
  if (brutos.length > MAX_LINHAS) return res.status(400).json({ error: `Importe no máximo ${MAX_LINHAS} lançamentos por vez.` });

  const categoriasDoUsuario = new Set(db.prepare('SELECT id FROM categorias WHERE user_id = ?').all(req.user.id).map(c => c.id));
  const itens = [];
  for (const [n, b] of brutos.entries()) {
    const linha = `Linha ${n + 1}`;
    const valor_centavos = paraCentavos(b?.valor);
    const desc = typeof b?.desc === 'string' ? b.desc.trim().slice(0, 120) : '';
    if (!desc)                                   return res.status(400).json({ error: `${linha}: informe a descrição.` });
    if (valor_centavos === null)                 return res.status(400).json({ error: `${linha}: valor inválido.` });
    if (b.tipo !== 'entrada' && b.tipo !== 'saida') return res.status(400).json({ error: `${linha}: tipo inválido.` });
    if (!dataValida(b.data))                     return res.status(400).json({ error: `${linha}: data inválida.` });
    if (!categoriasDoUsuario.has(b.categoria_id)) return res.status(400).json({ error: `${linha}: categoria não encontrada.` });
    const externo = typeof b.externo === 'string' && b.externo ? b.externo.slice(0, 80) : null;
    itens.push({ desc, valor_centavos, tipo: b.tipo, data: b.data, categoria_id: b.categoria_id, externo, obs: typeof b.obs === 'string' ? b.obs.slice(0, 500) : '' });
  }

  const importados = inserir(req.user.id, contaId, itens);
  aposLancamentos(req.user.id, itens);
  res.json({ importados, ignorados: itens.length - importados });
});

module.exports = router;
