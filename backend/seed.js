// Carga de dados de demonstração.
// Uso: npm run seed            -> grava em backend/demo.db (não toca no financeiro.db)
//      DB_PATH=outro.db npm run seed
//      npm run seed -- --email alguem@exemplo.com
// Os dados pertencem a uma conta: sem --email, usa a conta mais antiga do banco.
// Se o banco não tiver conta nenhuma, cria "demo@finanza.local" com a senha "demo1234".
// Reexecutar apaga lançamentos/recorrentes dessa conta e recria tudo.
const path = require('path');
require('./lib/env').carregarEnv(); // DB_PATH do .env, se houver
process.env.DB_PATH = process.env.DB_PATH || path.join(__dirname, 'demo.db');
const db = require('./db');
const { hashSenha } = require('./lib/auth');

const emailArg = (() => {
  const i = process.argv.indexOf('--email');
  return i >= 0 ? String(process.argv[i + 1] || '').trim().toLowerCase() : '';
})();

function contaAlvo() {
  if (emailArg) {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(emailArg);
    if (!user) {
      console.error(`Nenhuma conta com o e-mail ${emailArg} neste banco.`);
      process.exit(1);
    }
    return user;
  }

  const primeiro = db.prepare('SELECT * FROM users ORDER BY id ASC LIMIT 1').get();
  if (primeiro) return primeiro;

  const { lastInsertRowid } = db.prepare(
    'INSERT INTO users (nome, email, senha_hash, papel, status, criado_em, email_verificado_em) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run('Conta demo', 'demo@finanza.local', hashSenha('demo1234'), 'user', 'ativo', new Date().toISOString(), new Date().toISOString());
  const id = Number(lastInsertRowid);
  db.seedCategorias(id);
  db.seedContas(id);
  console.log('Conta de demonstração criada: demo@finanza.local / demo1234');
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

const { popularDemo } = require('./lib/demo');

const dono = contaAlvo();
const { recorrentes, lancamentos } = popularDemo(dono);

const resumo = db.prepare(`
  SELECT substr(data, 1, 7) AS mes,
         SUM(CASE WHEN tipo='entrada' THEN valor_centavos END) / 100.0 AS entradas,
         SUM(CASE WHEN tipo='saida'   THEN valor_centavos END) / 100.0 AS saidas,
         COUNT(*) AS lancamentos
  FROM transactions WHERE user_id = ? GROUP BY mes ORDER BY mes
`).all(dono.id);

console.log(`Carga gravada em ${process.env.DB_PATH} para ${dono.email}`);
console.table(resumo);
console.log(`${recorrentes} recorrentes, ${lancamentos} lançamentos.`);
