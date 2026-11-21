const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { migrar, ultimaVersao, versaoAtual } = require('../migrations');

// Reproduz o schema anterior às migrações versionadas (valor REAL, categoria pelo nome).
function bancoLegado() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      senha_hash TEXT NOT NULL, papel TEXT NOT NULL DEFAULT 'user', status TEXT NOT NULL DEFAULT 'ativo',
      trocar_senha INTEGER NOT NULL DEFAULT 0, criado_em TEXT NOT NULL, ultimo_acesso TEXT
    );
    CREATE TABLE categorias (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      nome TEXT NOT NULL, cor TEXT NOT NULL, UNIQUE (user_id, nome));
    CREATE TABLE transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      desc TEXT NOT NULL, valor REAL NOT NULL, tipo TEXT NOT NULL, cat TEXT NOT NULL, data TEXT NOT NULL, obs TEXT DEFAULT '');
    CREATE TABLE recorrentes (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      nome TEXT NOT NULL, valor REAL NOT NULL, tipo TEXT NOT NULL, cat TEXT NOT NULL, dia INTEGER NOT NULL, obs TEXT DEFAULT '');

    INSERT INTO users (id, nome, email, senha_hash, criado_em) VALUES (1, 'A', 'a@x.com', 'h', '2026-01-01'), (2, 'B', 'b@x.com', 'h', '2026-01-01');
    INSERT INTO categorias (user_id, nome, cor) VALUES (1, 'Mercado', '#111111'), (2, 'Mercado', '#222222');
    INSERT INTO transactions (user_id, desc, valor, tipo, cat, data, obs) VALUES
      (1, 'Compra',  19.99,   'saida',   'Mercado', '2026-03-01', 'x'),
      (1, 'Soma',    0.30000000000000004, 'saida', 'Mercado', '2026-03-02', NULL),
      (1, 'Sem cat', 10,      'saida',   'Apagada', '2026-03-03', ''),
      (2, 'Do B',    5.5,     'entrada', 'Mercado', '2026-03-04', ''),
      (NULL, 'Órfão', 7,      'saida',   'Mercado', '2026-03-05', '');
    INSERT INTO recorrentes (user_id, nome, valor, tipo, cat, dia, obs) VALUES (1, 'Aluguel', 2200.5, 'fixo', 'Mercado', 5, '');
  `);
  return db;
}

test('banco novo chega na última versão', () => {
  const db = new Database(':memory:');
  assert.deepEqual(migrar(db), [1, 2]);
  assert.equal(versaoAtual(db), ultimaVersao);
});

test('rodar de novo não faz nada', () => {
  const db = new Database(':memory:');
  migrar(db);
  assert.deepEqual(migrar(db), []);
});

test('banco legado: valores viram centavos e categoria vira id', () => {
  const db = bancoLegado();
  migrar(db);

  const tx = db.prepare(`
    SELECT t.descricao, t.valor_centavos, c.nome AS cat, t.user_id, t.obs
    FROM transactions t JOIN categorias c ON c.id = t.categoria_id ORDER BY t.id
  `).all();

  assert.deepEqual(tx.map(t => t.valor_centavos), [1999, 30, 1000, 550, 700]);
  assert.equal(tx[1].obs, '', 'obs nulo vira texto vazio');
  assert.deepEqual(tx.map(t => t.cat), ['Mercado', 'Mercado', 'Apagada', 'Mercado', 'Mercado']);

  const rec = db.prepare('SELECT valor_centavos FROM recorrentes').get();
  assert.equal(rec.valor_centavos, 220050);
});

test('banco legado: cada usuário continua com a própria categoria', () => {
  const db = bancoLegado();
  migrar(db);
  const corDe = id => db.prepare(`
    SELECT c.cor FROM transactions t JOIN categorias c ON c.id = t.categoria_id WHERE t.id = ?
  `).get(id).cor;
  assert.equal(corDe(1), '#111111'); // usuário 1
  assert.equal(corDe(4), '#222222'); // usuário 2
});

test('banco legado: categoria citada mas inexistente é criada', () => {
  const db = bancoLegado();
  migrar(db);
  const c = db.prepare("SELECT cor FROM categorias WHERE user_id = 1 AND nome = 'Apagada'").get();
  assert.ok(c);
});

test('as FKs ficam íntegras e o isolamento por usuário é mantido', () => {
  const db = bancoLegado();
  migrar(db);
  assert.deepEqual(db.pragma('foreign_key_check'), []);
  const cruzado = db.prepare(`
    SELECT COUNT(*) AS n FROM transactions t JOIN categorias c ON c.id = t.categoria_id
    WHERE t.user_id IS NOT c.user_id
  `).get().n;
  assert.equal(cruzado, 0);
});

test('migração que falha desfaz tudo e não avança a versão', () => {
  const db = bancoLegado();
  db.prepare("INSERT INTO transactions (user_id, desc, valor, tipo, cat, data) VALUES (1, 'Ruim', 5, 'saida', 'Mercado', 'ontem')").run();
  assert.throws(() => migrar(db), /CHECK|constraint/i);
  assert.equal(versaoAtual(db), 1, 'a baseline foi aplicada, a 002 não');
  assert.ok(db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'transactions' AND sql LIKE '%desc%'").get(), 'tabela antiga intacta');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM transactions').get().n, 6);
});

test('CHECKs barram dados inválidos direto no banco', () => {
  const db = new Database(':memory:');
  migrar(db);
  db.prepare("INSERT INTO users (nome, email, senha_hash, criado_em) VALUES ('A','a@x.com','h','2026-01-01')").run();
  db.prepare("INSERT INTO categorias (user_id, nome, cor) VALUES (1, 'X', '#000000')").run();
  const ins = (valor, tipo, data) => () => db.prepare(
    'INSERT INTO transactions (user_id, descricao, valor_centavos, tipo, categoria_id, data) VALUES (1, ?, ?, ?, 1, ?)'
  ).run('t', valor, tipo, data);
  assert.throws(ins(0, 'saida', '2026-01-01'));
  assert.throws(ins(100, 'outro', '2026-01-01'));
  assert.throws(ins(100, 'saida', 'ontem'));
  assert.doesNotThrow(ins(100, 'saida', '2026-01-01'));
});
