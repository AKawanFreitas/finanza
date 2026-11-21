// 1) Dinheiro deixa de ser REAL (erro de arredondamento) e vira INTEGER em centavos.
// 2) Lançamentos e recorrentes passam a apontar para a categoria por id (FK),
//    em vez de copiar o nome. Renomear categoria não precisa mais de UPDATE em cascata.
// 3) A coluna `desc` (palavra reservada do SQL) vira `descricao`.
// 4) Ganha CHECKs de tipo, valor, dia e formato de data.
const COR_PADRAO = '#8b90a0';

module.exports = {
  version: 2,
  name: 'centavos_e_categoria_id',
  up(db) {
    // Lançamentos antigos podem citar um nome que não existe mais em categorias: cria a categoria.
    for (const tabela of ['transactions', 'recorrentes']) {
      db.prepare(`
        INSERT INTO categorias (user_id, nome, cor)
        SELECT DISTINCT x.user_id, x.cat, ?
        FROM ${tabela} x
        WHERE NOT EXISTS (
          SELECT 1 FROM categorias c WHERE c.user_id IS x.user_id AND c.nome = x.cat
        )
      `).run(COR_PADRAO);
    }

    db.exec(`
      CREATE TABLE transactions_nova (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
        descricao     TEXT    NOT NULL,
        valor_centavos INTEGER NOT NULL CHECK (valor_centavos > 0),
        tipo          TEXT    NOT NULL CHECK (tipo IN ('entrada', 'saida')),
        categoria_id  INTEGER NOT NULL REFERENCES categorias(id) ON DELETE RESTRICT,
        data          TEXT    NOT NULL CHECK (data GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
        obs           TEXT    NOT NULL DEFAULT ''
      );

      INSERT INTO transactions_nova (id, user_id, descricao, valor_centavos, tipo, categoria_id, data, obs)
      SELECT t.id, t.user_id, t.desc, CAST(ROUND(t.valor * 100) AS INTEGER), t.tipo,
             (SELECT c.id FROM categorias c WHERE c.user_id IS t.user_id AND c.nome = t.cat),
             t.data, COALESCE(t.obs, '')
      FROM transactions t;

      DROP TABLE transactions;
      ALTER TABLE transactions_nova RENAME TO transactions;

      CREATE TABLE recorrentes_nova (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
        nome          TEXT    NOT NULL,
        valor_centavos INTEGER NOT NULL CHECK (valor_centavos > 0),
        tipo          TEXT    NOT NULL CHECK (tipo IN ('fixo', 'recorrente')),
        categoria_id  INTEGER NOT NULL REFERENCES categorias(id) ON DELETE RESTRICT,
        dia           INTEGER NOT NULL CHECK (dia BETWEEN 1 AND 31),
        obs           TEXT    NOT NULL DEFAULT ''
      );

      INSERT INTO recorrentes_nova (id, user_id, nome, valor_centavos, tipo, categoria_id, dia, obs)
      SELECT r.id, r.user_id, r.nome, CAST(ROUND(r.valor * 100) AS INTEGER), r.tipo,
             (SELECT c.id FROM categorias c WHERE c.user_id IS r.user_id AND c.nome = r.cat),
             r.dia, COALESCE(r.obs, '')
      FROM recorrentes r;

      DROP TABLE recorrentes;
      ALTER TABLE recorrentes_nova RENAME TO recorrentes;

      CREATE INDEX idx_transactions_user_data ON transactions(user_id, data);
      CREATE INDEX idx_transactions_categoria ON transactions(categoria_id);
      CREATE INDEX idx_recorrentes_user       ON recorrentes(user_id);
      CREATE INDEX idx_recorrentes_categoria  ON recorrentes(categoria_id);
    `);
  },
};
