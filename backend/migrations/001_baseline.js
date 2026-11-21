// Schema original do app (com contas de usuário). É idempotente de propósito:
// bancos criados antes das migrações versionadas entram aqui com user_version = 0
// e saem com o mesmo estado que um banco novo.
const hasTable  = (db, name) => !!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name);
const hasColumn = (db, table, col) => db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === col);

module.exports = {
  version: 1,
  name: 'baseline',
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        nome          TEXT    NOT NULL,
        email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
        senha_hash    TEXT    NOT NULL,
        papel         TEXT    NOT NULL DEFAULT 'user',
        status        TEXT    NOT NULL DEFAULT 'ativo',
        trocar_senha  INTEGER NOT NULL DEFAULT 0,
        criado_em     TEXT    NOT NULL,
        ultimo_acesso TEXT
      );

      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT    PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        criado_em  TEXT    NOT NULL,
        expira_em  TEXT    NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    `);

    // Bancos anteriores às contas: categorias tinha nome UNIQUE global, então é recriada por usuário.
    if (hasTable(db, 'categorias') && !hasColumn(db, 'categorias', 'user_id')) {
      db.exec(`
        ALTER TABLE categorias RENAME TO categorias_antiga;
        CREATE TABLE categorias (
          id      INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          nome    TEXT    NOT NULL,
          cor     TEXT    NOT NULL,
          UNIQUE (user_id, nome)
        );
        INSERT INTO categorias (id, nome, cor) SELECT id, nome, cor FROM categorias_antiga;
        DROP TABLE categorias_antiga;
      `);
    }

    db.exec(`
      CREATE TABLE IF NOT EXISTS transactions (
        id      INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        desc    TEXT    NOT NULL,
        valor   REAL    NOT NULL,
        tipo    TEXT    NOT NULL,
        cat     TEXT    NOT NULL,
        data    TEXT    NOT NULL,
        obs     TEXT    DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS recorrentes (
        id      INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        nome    TEXT    NOT NULL,
        valor   REAL    NOT NULL,
        tipo    TEXT    NOT NULL,
        cat     TEXT    NOT NULL,
        dia     INTEGER NOT NULL,
        obs     TEXT    DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS categorias (
        id      INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        nome    TEXT    NOT NULL,
        cor     TEXT    NOT NULL,
        UNIQUE (user_id, nome)
      );
    `);

    for (const table of ['transactions', 'recorrentes']) {
      if (!hasColumn(db, table, 'user_id')) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE`);
      }
    }

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_recorrentes_user  ON recorrentes(user_id);
      CREATE INDEX IF NOT EXISTS idx_categorias_user   ON categorias(user_id);
    `);
  },
};
