const MES_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const mesValido = s => typeof s === 'string' && MES_RE.test(s);

const diasNoMes = ym => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

// Soma `delta` meses a 'AAAA-MM'.
function deslocarMes(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// Data do vencimento no mês; dias 29–31 caem no último dia de meses curtos.
function dataVencimento(ym, dia) {
  return `${ym}-${String(Math.min(dia, diasNoMes(ym))).padStart(2, '0')}`;
}

function dataValida(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
}

// Data de hoje (AAAA-MM-DD) no fuso do Brasil: o servidor costuma rodar em UTC.
function hojeBR(agora = new Date()) {
  return new Date(agora.getTime() - 3 * 3600e3).toISOString().slice(0, 10);
}

// Dias do dia `a` até o dia `b` (negativo se b é anterior), ambos AAAA-MM-DD.
const diasEntre = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5);

const mesAtual = (agora = new Date()) => hojeBR(agora).slice(0, 7);

// Faixa aceita para datas gravadas: de 01/01/2000 até hoje + `anos` (10 por padrão). Pega erro de digitação
// (0026, 2205) sem barrar parcelas e recorrentes futuros. Comparação de texto: AAAA-MM-DD ordena certo.
const DATA_MINIMA = '2000-01-01';
const dataMaxima = (anos = 10, agora = new Date()) => {
  const hoje = hojeBR(agora);
  return `${Number(hoje.slice(0, 4)) + anos}${hoje.slice(4)}`;
};
const dataNaFaixa = (s, anos = 10) => s >= DATA_MINIMA && s <= dataMaxima(anos);
const mesNaFaixa  = ym => ym >= DATA_MINIMA.slice(0, 7) && ym <= dataMaxima().slice(0, 7);
const mensagemFaixa = (anos = 10) => `A data deve estar entre 01/01/2000 e ${dataMaxima(anos).split('-').reverse().join('/')}.`;

module.exports = {
  mesValido, diasNoMes, deslocarMes, dataVencimento, dataValida, hojeBR, diasEntre, mesAtual,
  dataNaFaixa, mesNaFaixa, mensagemFaixa,
};
