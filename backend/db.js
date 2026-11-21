const Database = require('better-sqlite3');
const path = require('path');
const fs   = require('fs');
const { migrar } = require('./migrations');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'financeiro.db');
const emMemoria = DB_PATH === ':memory:';

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Antes de mexer num banco que já tem dados, guarda uma cópia ao lado do arquivo.
function copiaDeSeguranca(deVersao) {
  if (emMemoria) return;
  const temDados = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'users'").get();
  if (!temDados) return;
  const destino = `${DB_PATH}.backup-v${deVersao}-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  if (!fs.existsSync(destino)) db.exec(`VACUUM INTO '${destino.replace(/'/g, "''")}'`);
}

migrar(db, { antes: copiaDeSeguranca });

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
  // Categoria órfã cujo nome a conta já tem violaria UNIQUE(user_id, nome):
  // os registros dela são religados à categoria que a conta já tem, e a repetida some.
  const repetidas = db.prepare(`
    SELECT o.id AS orfa, c.id AS existente
    FROM categorias o
    JOIN categorias c ON c.user_id = ? AND c.nome = o.nome COLLATE NOCASE
    WHERE o.user_id IS NULL
  `).all(userId);
  for (const { orfa, existente } of repetidas) {
    db.prepare('UPDATE transactions SET categoria_id = ? WHERE categoria_id = ?').run(existente, orfa);
    db.prepare('UPDATE recorrentes  SET categoria_id = ? WHERE categoria_id = ?').run(existente, orfa);
    db.prepare('DELETE FROM categorias WHERE id = ?').run(orfa);
  }

  let moved = 0;
  for (const table of ['transactions', 'recorrentes', 'categorias']) {
    moved += db.prepare(`UPDATE ${table} SET user_id = ? WHERE user_id IS NULL`).run(userId).changes;
  }
  return moved;
});

module.exports = db;
module.exports.seedCategorias = seedCategorias;
module.exports.adoptOrphans = adoptOrphans;
