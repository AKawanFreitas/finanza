const crypto = require('crypto');
const db = require('../../db');
const { paraCentavos } = require('../money');
const { lerOfx, ehOfx } = require('./ofx');
const { lerCsv } = require('./csv');

const MAX_LINHAS = 2000;

const normalizar = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

// Lê o conteúdo (OFX ou CSV) e devolve itens com tipo e centavos já calculados.
function lerArquivo(conteudo, formato = 'auto') {
  const texto = String(conteudo || '');
  if (!texto.trim()) throw new Error('O arquivo está vazio.');

  const fmt = formato === 'auto' ? (ehOfx(texto) ? 'ofx' : 'csv') : formato;
  const lido = fmt === 'ofx' ? lerOfx(texto) : lerCsv(texto);
  if (lido.itens.length > MAX_LINHAS) throw new Error(`O arquivo tem mais de ${MAX_LINHAS} lançamentos. Divida em arquivos menores.`);
  if (lido.itens.length === 0) throw new Error('Nenhum lançamento válido foi encontrado no arquivo.');

  const itens = lido.itens.map(i => ({
    data: i.data, desc: i.desc, obs: i.obs || '',
    tipo: i.valor > 0 ? 'entrada' : 'saida',
    valor_centavos: paraCentavos(Math.abs(i.valor)),
    externo: i.externo,
  })).filter(i => i.valor_centavos !== null);

  return { formato: fmt, itens, ignoradas: lido.ignoradas + (lido.itens.length - itens.length) };
}

// Sem id do banco (CSV comum), o id é um hash de data+valor+descrição+ordem de repetição.
// A ordem evita fundir duas compras idênticas no mesmo dia, e mantém o id estável ao reimportar o mesmo arquivo.
function atribuirIds(itens) {
  const vistos = new Map();
  return itens.map(i => {
    if (i.externo) return i;
    const base = `${i.data}|${i.tipo}|${i.valor_centavos}|${normalizar(i.desc)}`;
    const n = (vistos.get(base) || 0) + 1;
    vistos.set(base, n);
    return { ...i, externo: `h:${crypto.createHash('sha1').update(`${base}|${n}`).digest('hex').slice(0, 20)}` };
  });
}

// Categoria sugerida: a mais usada pelo usuário para a mesma descrição; senão uma padrão pelo tipo.
function sugerirCategorias(userId, itens) {
  const historico = db.prepare(`
    SELECT t.descricao, t.tipo, t.categoria_id, COUNT(*) AS n
    FROM transactions t WHERE t.user_id = ? GROUP BY t.descricao, t.tipo, t.categoria_id
  `).all(userId);
  const melhor = new Map();
  for (const h of historico) {
    const k = `${h.tipo}|${normalizar(h.descricao)}`;
    const atual = melhor.get(k);
    if (!atual || h.n > atual.n) melhor.set(k, h);
  }

  const porNome = nome => db.prepare('SELECT id FROM categorias WHERE user_id = ? AND nome = ? COLLATE NOCASE').get(userId, nome)?.id ?? null;
  const fallback = { entrada: porNome('Renda') ?? porNome('Outros'), saida: porNome('Outros') };
  const qualquer = db.prepare('SELECT id FROM categorias WHERE user_id = ? ORDER BY id LIMIT 1').get(userId)?.id ?? null;

  return itens.map(i => ({
    ...i,
    categoria_id: melhor.get(`${i.tipo}|${normalizar(i.desc)}`)?.categoria_id ?? fallback[i.tipo] ?? qualquer,
  }));
}

// 'importada' = já veio de uma importação (mesmo id); 'provavel' = mesma data e valor já lançados na conta.
function marcarDuplicadas(contaId, itens) {
  const porId = db.prepare('SELECT 1 FROM transactions WHERE conta_id = ? AND id_externo = ?');
  const porDataValor = db.prepare('SELECT 1 FROM transactions WHERE conta_id = ? AND data = ? AND valor_centavos = ? AND tipo = ? LIMIT 1');
  return itens.map(i => ({
    ...i,
    duplicada: porId.get(contaId, i.externo) ? 'importada'
      : porDataValor.get(contaId, i.data, i.valor_centavos, i.tipo) ? 'provavel' : null,
  }));
}

module.exports = { lerArquivo, atribuirIds, sugerirCategorias, marcarDuplicadas, MAX_LINHAS };
