// Lê um valor digitado do jeito brasileiro: "1.234,56", "1234,56", "R$ 10", "12.50" ou "-50" (saldo no vermelho).
// Sem vírgula, um ponto seguido de exatamente 3 dígitos é separador de milhar ("1.234" = mil duzentos e trinta e quatro).
// Mais de 2 casas decimais ou qualquer outro texto devolve NaN: o formulário mostra o erro em vez de arredondar escondido.
const COM_VIRGULA = /^\d{1,3}(\.\d{3})+(,\d{1,2})?$|^\d*,\d{1,2}$|^\d+$/;
const SEM_VIRGULA = /^\d+(\.\d{1,2})?$|^\d{1,3}(\.\d{3})+$/;

export function lerValor(texto) {
  let s = String(texto ?? '').replace(/R\$/gi, '').replace(/\s/g, '');
  const negativo = s.startsWith('-');
  if (negativo) s = s.slice(1);
  if (!s) return NaN;

  let n;
  if (s.includes(',')) {
    if (!COM_VIRGULA.test(s)) return NaN;
    n = Number(s.replace(/\./g, '').replace(',', '.'));
  } else {
    if (!SEM_VIRGULA.test(s)) return NaN;
    n = /^\d{1,3}(\.\d{3})+$/.test(s) ? Number(s.replace(/\./g, '')) : Number(s);
  }
  return negativo ? -n : n;
}

// Valor vindo da API (número) no formato do campo: 1234.5 -> "1234,50".
export const valorParaCampo = v => (v === null || v === undefined || v === '' ? '' : Number(v).toFixed(2).replace('.', ','));
