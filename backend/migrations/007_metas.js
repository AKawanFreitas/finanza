// Metas e reservas: um objetivo com valor e prazo opcional, alimentado por aportes (e retiradas).
// Os aportes são uma "caixinha" da própria meta: não mexem no saldo das contas.
module.exports = {
  version: 7,
  name: 'metas',
  up(db) {
    db.exec(`
      CREATE TABLE metas (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        nome                TEXT    NOT NULL,
        valor_alvo_centavos INTEGER NOT NULL CHECK (valor_alvo_centavos > 0),
        prazo               TEXT    CHECK (prazo IS NULL OR prazo GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
        cor                 TEXT    NOT NULL DEFAULT '#22a84a',
        arquivada           INTEGER NOT NULL DEFAULT 0 CHECK (arquivada IN (0, 1)),
        criado_em           TEXT    NOT NULL,
        UNIQUE (user_id, nome)
      );

      CREATE TABLE aportes (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        meta_id        INTEGER NOT NULL REFERENCES metas(id) ON DELETE CASCADE,
        user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        valor_centavos INTEGER NOT NULL CHECK (valor_centavos <> 0),
        data           TEXT    NOT NULL CHECK (data GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
        obs            TEXT    NOT NULL DEFAULT ''
      );
      CREATE INDEX idx_metas_user   ON metas(user_id);
      CREATE INDEX idx_aportes_meta ON aportes(meta_id, data);
    `);
  },
};
