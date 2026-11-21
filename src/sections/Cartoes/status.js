export const ROTULO_FATURA = {
  aberta: 'Aberta', fechada: 'Fechada', vencida: 'Vencida', parcial: 'Paga em parte', paga: 'Paga',
};

// Cor do chip (as mesmas classes do resto do app).
export const CLASSE_FATURA = { aberta: '', fechada: 'warn', vencida: 'bad', parcial: 'warn', paga: 'good' };

// Uso do limite: mesmos limiares dos orçamentos.
export const statusDeUso = pct => (pct >= 100 ? 'estourado' : pct >= 80 ? 'atencao' : 'ok');
