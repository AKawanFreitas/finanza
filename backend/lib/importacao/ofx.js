// Leitor de OFX (1.x em SGML, sem tags de fechamento, e 2.x em XML). Só lê o que o app usa:
// os blocos STMTTRN de extratos de conta e de cartão.
const { dataValida } = require('../datas');

const pegar = (bloco, tag) => {
  const m = bloco.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i'));
  return m ? m[1].trim() : '';
};

// "20260315120000[-3:BRT]" -> "2026-03-15"
function parseData(bruta) {
  const m = bruta.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}`;
  return dataValida(iso) ? iso : null;
}

// OFX usa ponto decimal; alguns bancos brasileiros mandam vírgula.
function parseValor(bruto) {
  let s = bruto.replace(/\s/g, '');
  if (!s) return null;
  if (s.includes(',') && !s.includes('.')) s = s.replace(',', '.');
  else if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const desescapar = s => s
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'");

function ehOfx(texto) {
  return /<OFX[\s>]/i.test(texto) || /OFXHEADER/i.test(texto);
}

// Devolve { itens: [{ data, desc, valor (com sinal, em reais), externo }], ignoradas }.
function lerOfx(texto) {
  const blocos = texto.match(/<STMTTRN>[\s\S]*?(?=<\/STMTTRN>|<STMTTRN>|<\/BANKTRANLIST>|<\/CCSTMTTRNRS>|$)/gi) || [];
  const itens = [];
  let ignoradas = 0;

  for (const bloco of blocos) {
    const data  = parseData(pegar(bloco, 'DTPOSTED'));
    const valor = parseValor(pegar(bloco, 'TRNAMT'));
    if (!data || valor === null || valor === 0) { ignoradas++; continue; }

    const nome = desescapar(pegar(bloco, 'NAME'));
    const memo = desescapar(pegar(bloco, 'MEMO'));
    const desc = (nome || memo || 'Sem descrição').slice(0, 120);
    const fitid = pegar(bloco, 'FITID');
    itens.push({ data, desc, valor, externo: fitid ? `ofx:${fitid}` : null, obs: nome && memo && memo !== nome ? memo.slice(0, 500) : '' });
  }
  return { itens, ignoradas };
}

module.exports = { lerOfx, ehOfx };
