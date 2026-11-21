// Contas a pagar (boletos, contas de consumo): um compromisso com vencimento. Pagar gera um lançamento
// (saída) e guarda o vínculo em transacao_id. O status não é gravado: "paga" é ter lançamento vinculado,
// e "atrasada" é estar sem lançamento depois do vencimento. Se a pessoa apagar o lançamento, a conta volta a pendente.
module.exports = {
  version: 8,
  name: 'contas_a_pagar',
  up(db) {
    db.exec(`
      CREATE TABLE contas_pagar (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        descricao      TEXT    NOT NULL,
        valor_centavos INTEGER NOT NULL CHECK (valor_centavos > 0),
        vencimento     TEXT    NOT NULL CHECK (vencimento GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
        categoria_id   INTEGER NOT NULL REFERENCES categorias(id),
        conta_id       INTEGER REFERENCES contas(id),
        obs            TEXT    NOT NULL DEFAULT '',
        transacao_id   INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
        criado_em      TEXT    NOT NULL
      );
      CREATE INDEX idx_contas_pagar_user ON contas_pagar(user_id, vencimento);
      CREATE INDEX idx_contas_pagar_tx   ON contas_pagar(transacao_id);
    `);
  },
};
