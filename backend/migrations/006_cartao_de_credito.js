// Cartão de crédito. Um cartão é uma conta (tipo 'cartao') cujo saldo é a dívida: compras o deixam
// negativo e o pagamento da fatura (uma transferência para ele) o traz de volta a zero. Assim o saldo
// total das contas continua sendo o patrimônio líquido, sem lógica especial.
//  - contas.tipo ganha 'cartao' (o CHECK só muda reconstruindo a tabela).
//  - cartoes: limite, dia de fechamento, dia de vencimento e conta sugerida para pagar.
//  - transactions: grupo e número da parcela (compra parcelada = N lançamentos, um por fatura).
//  - transferencias.fatura_ref: a fatura (AAAA-MM) que o pagamento quita.
// A fatura de um lançamento não é gravada: é calculada pela data e pelo dia de fechamento.
module.exports = {
  version: 6,
  name: 'cartao_de_credito',
  reconstroiTabelaPai: true,
  up(db) {
    db.exec(`
      CREATE TABLE contas_nova (
        id                     INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id                INTEGER REFERENCES users(id) ON DELETE CASCADE,
        nome                   TEXT    NOT NULL,
        tipo                   TEXT    NOT NULL CHECK (tipo IN ('corrente', 'poupanca', 'carteira', 'investimento', 'cartao')),
        cor                    TEXT    NOT NULL DEFAULT '#4d9fff',
        saldo_inicial_centavos INTEGER NOT NULL DEFAULT 0,
        arquivada              INTEGER NOT NULL DEFAULT 0 CHECK (arquivada IN (0, 1)),
        criado_em              TEXT    NOT NULL,
        UNIQUE (user_id, nome)
      );
      INSERT INTO contas_nova (id, user_id, nome, tipo, cor, saldo_inicial_centavos, arquivada, criado_em)
        SELECT id, user_id, nome, tipo, cor, saldo_inicial_centavos, arquivada, criado_em FROM contas;
      DROP TABLE contas;
      ALTER TABLE contas_nova RENAME TO contas;
      CREATE INDEX idx_contas_user ON contas(user_id);

      CREATE TABLE cartoes (
        conta_id           INTEGER PRIMARY KEY REFERENCES contas(id) ON DELETE CASCADE,
        limite_centavos    INTEGER NOT NULL CHECK (limite_centavos > 0),
        dia_fechamento     INTEGER NOT NULL CHECK (dia_fechamento BETWEEN 1 AND 31),
        dia_vencimento     INTEGER NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
        conta_pagamento_id INTEGER REFERENCES contas(id) ON DELETE SET NULL
      );

      ALTER TABLE transactions ADD COLUMN grupo_parcelas TEXT;
      ALTER TABLE transactions ADD COLUMN parcela_numero INTEGER
        CHECK (parcela_numero IS NULL OR parcela_numero >= 1);
      ALTER TABLE transactions ADD COLUMN parcela_total INTEGER
        CHECK (parcela_total IS NULL OR parcela_total BETWEEN 2 AND 48);
      CREATE INDEX idx_transactions_grupo ON transactions(grupo_parcelas) WHERE grupo_parcelas IS NOT NULL;

      ALTER TABLE transferencias ADD COLUMN fatura_ref TEXT
        CHECK (fatura_ref IS NULL OR fatura_ref GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]');
    `);
  },
};
