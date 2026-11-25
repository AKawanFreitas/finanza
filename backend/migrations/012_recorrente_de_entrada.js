// Recorrente de entrada (salário, aluguel recebido): `movimento` diz se o lançamento gerado é receita ou gasto.
// Os recorrentes que já existem eram todos gastos, então o padrão é 'saida'.
module.exports = {
  version: 12,
  name: 'recorrente_de_entrada',
  up(db) {
    db.exec(`
      ALTER TABLE recorrentes ADD COLUMN movimento TEXT NOT NULL DEFAULT 'saida' CHECK (movimento IN ('entrada', 'saida'));
    `);
  },
};
