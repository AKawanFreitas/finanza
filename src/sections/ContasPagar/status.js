export const ROTULO = { pendente: 'Pendente', atrasada: 'Atrasada', paga: 'Paga' };
export const CLASSE = { pendente: '', atrasada: 'bad', paga: 'good' };

// "vence hoje", "vence em 3 dias", "atrasada há 2 dias"
export function descreverPrazo(dias) {
  if (dias === 0) return 'vence hoje';
  if (dias === 1) return 'vence amanhã';
  if (dias > 1) return `vence em ${dias} dias`;
  return `há ${-dias} ${dias === -1 ? 'dia' : 'dias'} em atraso`;
}
