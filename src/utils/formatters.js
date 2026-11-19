import {
  Utensils, Home, Car, Heart, Gamepad2,
  DollarSign, BookOpen, Package, Pin,
} from 'lucide-react';

export function fmt(v) {
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function getCatColor(categorias, name) {
  const c = categorias.find(c => c.nome === name);
  return c ? c.cor : '#9aa3b2';
}

const CAT_ICONS = {
  'Alimentação': Utensils,
  'Moradia':     Home,
  'Transporte':  Car,
  'Saúde':       Heart,
  'Lazer':       Gamepad2,
  'Renda':       DollarSign,
  'Educação':    BookOpen,
  'Outros':      Package,
};

export function catIcon(cat) {
  return CAT_ICONS[cat] || Pin;
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
