// Leitor de CSV de extratos bancários brasileiros: detecta separador (; , ou tab), aspas,
// datas DD/MM/AAAA ou AAAA-MM-DD e valores no formato "1.234,56" ou "1234.56".
const { dataValida } = require('../datas');

function detectarSeparador(linhaCabecalho) {
  const cont = s => linhaCabecalho.split(s).length - 1;
  return [';', '\t', ','].map(s => [s, cont(s)]).sort((a, b) => b[1] - a[1])[0][0];
}

// Divide o texto em linhas de campos, respeitando aspas (inclusive quebras de linha dentro delas).
function dividir(texto, sep) {
  const linhas = [];
  let campo = '', linha = [], aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (aspas) {
      if (ch === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (ch === '"') aspas = false;
      else campo += ch;
    } else if (ch === '"') aspas = true;
    else if (ch === sep) { linha.push(campo); campo = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && texto[i + 1] === '\n') i++;
      linha.push(campo); campo = '';
      if (linha.some(c => c.trim() !== '')) linhas.push(linha);
      linha = [];
    } else campo += ch;
  }
  linha.push(campo);
  if (linha.some(c => c.trim() !== '')) linhas.push(linha);
  return linhas;
}

const normalizar = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const COLUNAS = {
  data:      ['data', 'date', 'dt', 'data lancamento', 'data da compra', 'data mov', 'data movimentacao', 'data transacao'],
  desc:      ['descricao', 'description', 'historico', 'lancamento', 'estabelecimento', 'memo', 'detalhes', 'titulo', 'nome'],
  valor:     ['valor', 'amount', 'valor (r$)', 'quantia', 'montante'],
  debito:    ['debito', 'saida', 'saidas', 'debit', 'valor debito'],
  credito:   ['credito', 'entrada', 'entradas', 'credit', 'valor credito'],
  id:        ['id', 'identificador', 'fitid', 'documento', 'numero documento'],
};

function achar(cabecalho, nomes) {
  const norm = cabecalho.map(normalizar);
  for (const n of nomes) { const i = norm.indexOf(n); if (i >= 0) return i; }
  // Segunda chance: cabeçalho que contém o termo (ex.: "Data do lançamento").
  for (const n of nomes) { const i = norm.findIndex(c => c.includes(n)); if (i >= 0) return i; }
  return -1;
}

function parseData(s) {
  const t = String(s).trim();
  let m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (m) {
    const iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return dataValida(iso) ? iso : null;
  }
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return dataValida(`${m[1]}-${m[2]}-${m[3]}`) ? `${m[1]}-${m[2]}-${m[3]}` : null;
  return null;
}

// "R$ 1.234,56", "-1.234,56", "(50,00)", "1234.56", "1,234.56"
function parseValor(bruto) {
  let s = String(bruto).replace(/R\$|\s/g, '');
  if (!s) return null;
  let negativo = false;
  if (/^\(.*\)$/.test(s)) { negativo = true; s = s.slice(1, -1); }
  if (s.startsWith('-')) { negativo = !negativo; s = s.slice(1); }
  else if (s.startsWith('+')) s = s.slice(1);
  if (s.endsWith('-')) { negativo = !negativo; s = s.slice(0, -1); }

  const ponto = s.lastIndexOf('.'), virgula = s.lastIndexOf(',');
  if (ponto >= 0 && virgula >= 0) {
    // O último separador é o decimal.
    s = ponto > virgula ? s.replace(/,/g, '') : s.replace(/\./g, '').replace(',', '.');
  } else if (virgula >= 0) s = s.replace(',', '.');
  else if (ponto >= 0 && /^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ''); // "1.234" = mil duzentos e trinta e quatro
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return negativo ? -n : n;
}

// Devolve { itens: [{ data, desc, valor (com sinal), externo, obs }], ignoradas } ou lança Error com a causa.
function lerCsv(texto) {
  const limpo = texto.replace(/^﻿/, '');
  const primeira = limpo.split(/\r?\n/).find(l => l.trim() !== '') || '';
  const linhas = dividir(limpo, detectarSeparador(primeira));
  if (linhas.length < 2) throw new Error('O arquivo CSV não tem linhas de dados.');

  const [cab, ...corpo] = linhas;
  const iData = achar(cab, COLUNAS.data), iDesc = achar(cab, COLUNAS.desc);
  const iValor = achar(cab, COLUNAS.valor);
  const iDeb = achar(cab, COLUNAS.debito), iCred = achar(cab, COLUNAS.credito);
  const iId = achar(cab, COLUNAS.id);

  if (iData < 0 || iDesc < 0 || (iValor < 0 && iDeb < 0 && iCred < 0)) {
    throw new Error(`Não identifiquei as colunas de data, descrição e valor. Colunas encontradas: ${cab.map(c => c.trim()).join(', ')}.`);
  }

  const itens = [];
  let ignoradas = 0;
  for (const l of corpo) {
    const data = parseData(l[iData] ?? '');
    let valor = null;
    if (iValor >= 0) valor = parseValor(l[iValor] ?? '');
    if (valor === null && (iDeb >= 0 || iCred >= 0)) {
      const cred = iCred >= 0 ? parseValor(l[iCred] ?? '') : null;
      const deb  = iDeb  >= 0 ? parseValor(l[iDeb]  ?? '') : null;
      if (cred) valor = Math.abs(cred);
      else if (deb) valor = -Math.abs(deb);
    }
    if (!data || valor === null || valor === 0) { ignoradas++; continue; }
    const desc = String(l[iDesc] ?? '').trim().replace(/\s+/g, ' ').slice(0, 120) || 'Sem descrição';
    const idBanco = iId >= 0 ? String(l[iId] ?? '').trim() : '';
    itens.push({ data, desc, valor, externo: idBanco ? `csv:${idBanco}` : null, obs: '' });
  }
  return { itens, ignoradas };
}

module.exports = { lerCsv, parseValor, parseData };
