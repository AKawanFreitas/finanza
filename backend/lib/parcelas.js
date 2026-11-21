const { deslocarMes, diasNoMes } = require('./datas');

// Divide um total em N parcelas sem perder centavo: as primeiras recebem 1 centavo a mais até fechar a conta.
// 100,00 em 3x -> 33,34 + 33,33 + 33,33.
function dividirParcelas(totalCentavos, n) {
  const base = Math.floor(totalCentavos / n);
  const resto = totalCentavos - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < resto ? 1 : 0));
}

// Data da parcela k (0 = a da compra): mesmo dia nos meses seguintes, ou o último dia se o mês for mais curto.
function dataDaParcela(dataISO, k) {
  const mes = deslocarMes(dataISO.slice(0, 7), k);
  const dia = Math.min(Number(dataISO.slice(8)), diasNoMes(mes));
  return `${mes}-${String(dia).padStart(2, '0')}`;
}

module.exports = { dividirParcelas, dataDaParcela };
