// Dinheiro é guardado em centavos (inteiro). A API continua falando em reais
// (número com até 2 casas), e a conversão acontece só nas bordas.
const MAX_CENTAVOS = 100_000_000_000; // R$ 1 bilhão

// Aceita número ou texto numérico. Devolve centavos inteiros ou null se for inválido.
function paraCentavos(valor) {
  if (typeof valor === 'string' && valor.trim() === '') return null;
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0) return null;
  // toPrecision(15) remove o ruído de ponto flutuante (1.005 * 100 = 100.49999999999999).
  const centavos = Math.round(Number((n * 100).toPrecision(15)));
  return centavos >= 1 && centavos <= MAX_CENTAVOS ? centavos : null;
}

// Para saldos, que podem ser zero ou negativos (conta no vermelho).
function paraCentavosComSinal(valor) {
  if (typeof valor === 'string' && valor.trim() === '') return null;
  const n = Number(valor);
  if (!Number.isFinite(n)) return null;
  const centavos = Math.round(Number((n * 100).toPrecision(15)));
  return Math.abs(centavos) <= MAX_CENTAVOS ? centavos : null;
}

const paraReais = centavos => centavos / 100;

module.exports = { paraCentavos, paraCentavosComSinal, paraReais, MAX_CENTAVOS };
