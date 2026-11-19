export function fmt(v) {
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function getCatColor(categorias, name) {
  const c = categorias.find(c => c.nome === name);
  return c ? c.cor : '#9aa3b2';
}

export function today() {
  return new Date().toISOString().split('T')[0];
}

export function fmtDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// Data (AAAA-MM-DD) do vencimento no mês de `ref`; dias 29–31 caem no último dia de meses curtos.
export function dueDate(dia, ref = new Date()) {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const last = new Date(y, m + 1, 0).getDate();
  const d = Math.min(dia, last);
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
