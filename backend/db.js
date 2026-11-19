const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(process.env.DB_PATH || path.join(__dirname, 'financeiro.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    desc  TEXT    NOT NULL,
    valor REAL    NOT NULL,
    tipo  TEXT    NOT NULL,
    cat   TEXT    NOT NULL,
    data  TEXT    NOT NULL,
    obs   TEXT    DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS recorrentes (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    nome  TEXT    NOT NULL,
    valor REAL    NOT NULL,
    tipo  TEXT    NOT NULL,
    cat   TEXT    NOT NULL,
    dia   INTEGER NOT NULL,
    obs   TEXT    DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS categorias (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    nome  TEXT    NOT NULL UNIQUE,
    cor   TEXT    NOT NULL
  );
`);

const catCount = db.prepare('SELECT COUNT(*) as n FROM categorias').get();
if (catCount.n === 0) {
  const insert = db.prepare('INSERT INTO categorias (nome, cor) VALUES (?, ?)');
  const seeds = [
    ['Alimentação', '#ff6b6b'],
    ['Moradia',     '#4d9fff'],
    ['Transporte',  '#ffb547'],
    ['Saúde',       '#00d68f'],
    ['Lazer',       '#a78bfa'],
    ['Renda',       '#34d399'],
    ['Educação',    '#f472b6'],
    ['Outros',      '#8b90a0'],
  ];
  for (const [nome, cor] of seeds) insert.run(nome, cor);
}

module.exports = db;
