export const TIPOS_CONTA = [
  { value: 'corrente',     label: 'Conta corrente' },
  { value: 'poupanca',     label: 'Poupança' },
  { value: 'carteira',     label: 'Carteira (dinheiro)' },
  { value: 'investimento', label: 'Investimentos' },
];

export const rotuloTipo = tipo => TIPOS_CONTA.find(t => t.value === tipo)?.label ?? tipo;
