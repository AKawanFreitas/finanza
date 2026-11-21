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
  assert.deepEqual(migrar(db), [1, 2, 3, 4, 5, 6, 7]);
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

test('banco legado: cada usuário ganha uma conta e os lançamentos vão para ela', () => {
  const db = bancoLegado();
  migrar(db);
  const contas = db.prepare('SELECT user_id, nome FROM contas ORDER BY id').all();
  assert.deepEqual(contas.filter(c => c.user_id !== null).map(c => c.nome), ['Conta principal', 'Conta principal']);
  assert.equal(contas.filter(c => c.user_id === null).length, 1, 'os lançamentos órfãos ganham uma conta órfã');
  const fora = db.prepare('SELECT COUNT(*) AS n FROM transactions t JOIN contas c ON c.id = t.conta_id WHERE c.user_id IS NOT t.user_id').get().n;
  assert.equal(fora, 0);
  assert.deepEqual(db.pragma('foreign_key_check'), []);
});

test('banco legado: lançamentos de recorrentes são ligados, um por mês', () => {
  const db = bancoLegado();
  // Mesmo nome e categoria do recorrente 'Aluguel' (Mercado, usuário 1): dois no mesmo mês e um em outro.
  db.exec(`
    INSERT INTO transactions (user_id, desc, valor, tipo, cat, data) VALUES
      (1, 'Aluguel', 2200.5, 'saida', 'Mercado', '2026-03-05'),
      (1, 'Aluguel', 2200.5, 'saida', 'Mercado', '2026-03-06'),
      (1, 'Aluguel', 2200.5, 'saida', 'Mercado', '2026-04-05');
  `);
  migrar(db);
  const ligados = db.prepare('SELECT substr(data, 1, 7) AS mes, COUNT(*) AS n FROM transactions WHERE recorrente_id IS NOT NULL GROUP BY mes ORDER BY mes').all();
  assert.deepEqual(ligados, [{ mes: '2026-03', n: 1 }, { mes: '2026-04', n: 1 }]);
});

test('006: contas ganha o tipo cartão sem perder dados nem quebrar as FKs', () => {
  const db = bancoLegado();
  migrar(db);
  const antes = db.prepare('SELECT id, user_id, nome FROM contas ORDER BY id').all();
  const txAntes = db.prepare('SELECT COUNT(*) AS n FROM transactions').get().n;
  assert.deepEqual(db.pragma('foreign_key_check'), []);
  assert.equal(db.pragma('foreign_keys', { simple: true }), 1, 'FKs religadas depois da migração');
  assert.doesNotThrow(() => db.prepare("INSERT INTO contas (user_id, nome, tipo, criado_em) VALUES (1, 'Nubank', 'cartao', 'x')").run());
  assert.throws(() => db.prepare("INSERT INTO contas (user_id, nome, tipo, criado_em) VALUES (1, 'X', 'inexistente', 'x')").run());
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM transactions').get().n, txAntes);
  assert.deepEqual(db.prepare('SELECT id, user_id, nome FROM contas WHERE nome <> ? ORDER BY id').all('Nubank'), antes);
});

test('006: as tabelas filhas continuam apontando para contas (e a exclusão em cascata funciona)', () => {
  const db = bancoLegado();
  migrar(db);
  const fks = tabela => db.pragma(`foreign_key_list(${tabela})`).map(f => f.table);
  assert.ok(fks('transactions').includes('contas'));
  assert.ok(fks('transferencias').includes('contas'));
  assert.ok(!db.prepare("SELECT name FROM sqlite_master WHERE name = 'contas_nova'").get());
  db.prepare('DELETE FROM users WHERE id = 1').run();
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM contas WHERE user_id = 1').get().n, 0);
});

test('006: migração que deixaria uma FK quebrada é desfeita e as FKs voltam a valer', () => {
  const db = new Database(':memory:');
  migrar(db, {});
  // Simula uma migração futura defeituosa com o mesmo mecanismo.
  const { migrations } = require('../migrations');
  const ruim = { version: 999, name: 'ruim', reconstroiTabelaPai: true, up(d) { d.exec("INSERT INTO transactions (user_id, conta_id, descricao, valor_centavos, tipo, categoria_id, data) VALUES (1, 9999, 'x', 1, 'saida', 9999, '2026-01-01')"); } };
  migrations.push(ruim);
  try {
    assert.throws(() => migrar(db), /chave\(s\) estrangeira/);
  } finally {
    migrations.pop();
  }
  assert.equal(db.pragma('foreign_keys', { simple: true }), 1);
  assert.equal(db.pragma('user_version', { simple: true }), ultimaVersao, 'a versão não avançou');
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
  db.prepare("INSERT INTO contas (user_id, nome, tipo, criado_em) VALUES (1, 'C', 'corrente', '2026-01-01')").run();
  const ins = (valor, tipo, data) => () => db.prepare(
    'INSERT INTO transactions (user_id, conta_id, descricao, valor_centavos, tipo, categoria_id, data) VALUES (1, 1, ?, ?, ?, 1, ?)'
  ).run('t', valor, tipo, data);
  assert.throws(ins(0, 'saida', '2026-01-01'));
  assert.throws(ins(100, 'outro', '2026-01-01'));
  assert.throws(ins(100, 'saida', 'ontem'));
  assert.doesNotThrow(ins(100, 'saida', '2026-01-01'));
});
