const Database = require('better-sqlite3');
const path = require('path');
const fs   = require('fs');
const { migrar } = require('./migrations');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'financeiro.db');
const emMemoria = DB_PATH === ':memory:';

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Texto sem acento e em minúsculas, para buscar "acao" e achar "Ação" (o LIKE do SQLite só ignora caixa em ASCII).
const normalizar = s => (s == null ? '' : String(s)).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
db.function('normalizar', { deterministic: true }, normalizar);

// Antes de mexer num banco que já tem dados, guarda uma cópia ao lado do arquivo.
function copiaDeSeguranca(deVersao) {
  if (emMemoria) return;
  const temDados = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'users'").get();
  if (!temDados) return;
  const destino = `${DB_PATH}.backup-v${deVersao}-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  if (!fs.existsSync(destino)) db.exec(`VACUUM INTO '${destino.replace(/'/g, "''")}'`);
}

migrar(db, { antes: copiaDeSeguranca });

const { ICONE_PADRAO } = require('./lib/icones');

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

const insertCategoria = db.prepare('INSERT INTO categorias (user_id, nome, cor, icone) VALUES (?, ?, ?, ?)');

// Categorias iniciais de uma conta nova (ou de uma conta que ainda não tem nenhuma).
function seedCategorias(userId) {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM categorias WHERE user_id = ?').get(userId);
  if (n > 0) return;
  for (const [nome, cor] of DEFAULT_CATEGORIAS) insertCategoria.run(userId, nome, cor, ICONE_PADRAO[nome] ?? 'tag');
}

// Conta inicial de um usuário novo (se ainda não tiver nenhuma).
function seedContas(userId) {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM contas WHERE user_id = ?').get(userId);
  if (n > 0) return;
  db.prepare("INSERT INTO contas (user_id, nome, tipo, criado_em) VALUES (?, 'Conta principal', 'corrente', ?)")
    .run(userId, new Date().toISOString());
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

  // Conta órfã com o mesmo nome de uma que o dono já tem: os lançamentos vão para a dele.
  const contasRepetidas = db.prepare(`
    SELECT o.id AS orfa, c.id AS existente
    FROM contas o JOIN contas c ON c.user_id = ? AND c.nome = o.nome COLLATE NOCASE
    WHERE o.user_id IS NULL
  `).all(userId);
  for (const { orfa, existente } of contasRepetidas) {
    db.prepare('UPDATE transactions SET conta_id = ? WHERE conta_id = ?').run(existente, orfa);
    db.prepare('UPDATE transferencias SET origem_id = ? WHERE origem_id = ?').run(existente, orfa);
    db.prepare('UPDATE transferencias SET destino_id = ? WHERE destino_id = ?').run(existente, orfa);
    db.prepare('DELETE FROM contas WHERE id = ?').run(orfa);
  }

  let moved = 0;
  for (const table of ['transactions', 'recorrentes', 'categorias', 'contas']) {
    moved += db.prepare(`UPDATE ${table} SET user_id = ? WHERE user_id IS NULL`).run(userId).changes;
  }
  return moved;
});

module.exports = db;
module.exports.seedCategorias = seedCategorias;
module.exports.seedContas = seedContas;
module.exports.adoptOrphans = adoptOrphans;
module.exports.normalizar = normalizar;
