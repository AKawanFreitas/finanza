export function fmt(v) {
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function getCatColor(categorias, name) {
  const c = categorias.find(c => c.nome === name);
  return c ? c.cor : '#8b90a0';
}

export function catIcon(cat) {
  return {
    'Alimentação': '🍽', 'Moradia': '🏠', 'Transporte': '🚗',
    'Saúde': '💊', 'Lazer': '🎮', 'Renda': '💰',
    'Educação': '📚', 'Outros': '📦',
  }[cat] || '📌';
}

export function today() {
  return new Date().toISOString().split('T')[0];
}
