export const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
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

export function daysInMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}
