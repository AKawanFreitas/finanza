const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                     'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

export const MONTH_ABBR = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

// '2026-11' -> 'Novembro 2026'
export function ymToPeriod(ym) {
  const [y, m] = ym.split('-');
  return `${MONTH_NAMES[Number(m) - 1]} ${y}`;
}

// 'Novembro 2026' -> '2026-11'
export function periodToYM(period) {
  const [name, year] = period.split(' ');
  return `${year}-${String(MONTH_NAMES.indexOf(name) + 1).padStart(2, '0')}`;
}

export function currentYM(ref = new Date()) {
  return `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}`;
}

// Soma `delta` meses a um 'AAAA-MM'.
export function shiftYM(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return currentYM(d);
}

// Mês atual + todos os meses que têm lançamentos, do mais recente ao mais antigo.
export function periodOptions(transactions) {
  const months = new Set([currentYM()]);
  transactions.forEach(t => months.add(t.data.slice(0, 7)));
  return [...months].sort().reverse().map(ym => ({ value: ymToPeriod(ym), label: ymToPeriod(ym) }));
}
