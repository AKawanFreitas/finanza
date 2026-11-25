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

// Validação estrita do que chega pela API, com o motivo do erro. Diferente de paraCentavos (que arredonda,
// e serve à leitura de extratos), aqui nada é arredondado em silêncio: "0x10", "1e3" e 10.999 são recusados.
// Devolve { centavos } ou { erro }. Com `sinal`, aceita zero e negativos (saldo no vermelho).
const NUMERO = /^-?\d+(\.\d+)?$/;
function validarValor(valor, { sinal = false } = {}) {
  const formato = { erro: 'Valor inválido: use só números, com ponto antes dos centavos (ex.: 1234.56).' };
  let n;
  if (typeof valor === 'number') n = valor;
  else if (typeof valor === 'string' && NUMERO.test(valor.trim())) n = Number(valor.trim());
  else return formato;
  if (!Number.isFinite(n)) return formato;

  const centavos = Number((n * 100).toPrecision(15));
  if (!Number.isInteger(centavos)) return { erro: 'Use no máximo 2 casas decimais nos centavos.' };
  if (Math.abs(centavos) > MAX_CENTAVOS) return { erro: 'O valor máximo é R$ 1 bilhão.' };
  if (!sinal && centavos < 1) return { erro: 'O valor deve ser maior que zero.' };
  return { centavos: centavos === 0 ? 0 : centavos }; // sem -0
}

module.exports = { paraCentavos, paraCentavosComSinal, paraReais, validarValor, MAX_CENTAVOS };
