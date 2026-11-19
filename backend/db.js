const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(process.env.DB_PATH || path.join(__dirname, 'financeiro.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const DEFAULT_CATEGORIAS = [
  ['Alimentação', '#ff6b6b'],
  ['Moradia',     '#4d9fff'],
  ['Transporte',  '#ffb547'],
  ['Saúde',       '#00d68f'],
  ['Lazer',       '#a78bfa'],
  ['Renda',       '#34d399'],
  ['Educação',    '#f472b6'],
  ['Outros',      '#8b90a0'],
];

const hasTable  = name => !!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name);
const hasColumn = (table, col) => db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === col);

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

// Bancos criados antes das contas: categorias tinha nome UNIQUE global, então é recriada por usuário.
if (hasTable('categorias') && !hasColumn('categorias', 'user_id')) {
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
  if (!hasColumn(table, 'user_id')) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE`);
  }
}

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
  CREATE INDEX IF NOT EXISTS idx_recorrentes_user  ON recorrentes(user_id);
  CREATE INDEX IF NOT EXISTS idx_categorias_user   ON categorias(user_id);
`);

const insertCategoria = db.prepare('INSERT INTO categorias (user_id, nome, cor) VALUES (?, ?, ?)');

// Categorias iniciais de uma conta nova (ou de uma conta que ainda não tem nenhuma).
function seedCategorias(userId) {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM categorias WHERE user_id = ?').get(userId);
  if (n > 0) return;
  for (const [nome, cor] of DEFAULT_CATEGORIAS) insertCategoria.run(userId, nome, cor);
}

// Dados gravados antes das contas (user_id nulo) passam para o dono informado.
// Tudo numa transação: ou a adoção inteira vale, ou nada muda.
const adoptOrphans = db.transaction((userId) => {
  // Categoria antiga cujo nome a conta já tem seria barrada por UNIQUE(user_id, nome).
  // Como lançamentos guardam a categoria pelo nome, a repetida pode ser descartada.
  db.prepare(`
    DELETE FROM categorias
    WHERE user_id IS NULL
      AND nome IN (SELECT nome FROM categorias WHERE user_id = ? COLLATE NOCASE)
  `).run(userId);

  let moved = 0;
  for (const table of ['transactions', 'recorrentes', 'categorias']) {
    moved += db.prepare(`UPDATE ${table} SET user_id = ? WHERE user_id IS NULL`).run(userId).changes;
  }
  return moved;
});

module.exports = db;
module.exports.seedCategorias = seedCategorias;
module.exports.adoptOrphans = adoptOrphans;
