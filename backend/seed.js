// Carga de dados de demonstração.
// Uso: npm run seed            -> grava em backend/demo.db (não toca no financeiro.db)
//      DB_PATH=outro.db npm run seed
//      npm run seed -- --email alguem@exemplo.com
// Os dados pertencem a uma conta: sem --email, usa a conta mais antiga do banco.
// Se o banco não tiver conta nenhuma, cria "demo@finanza.local" com a senha "demo1234".
// Reexecutar apaga lançamentos/recorrentes dessa conta e recria tudo.
const path = require('path');
process.env.DB_PATH = process.env.DB_PATH || path.join(__dirname, 'demo.db');
const db = require('./db');
const { hashSenha } = require('./lib/auth');
const { contaPadrao } = require('./lib/contas');

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

const dono = contaAlvo();

const MESES = 5; // mês atual + 4 anteriores

// PRNG determinístico: a carga é sempre a mesma
let s = 42;
const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
const between = (a, b) => a + rnd() * (b - a);
const money = (a, b) => Math.round(between(a, b) * 100) / 100;
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

const pad = (n) => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

const recorrentes = [
  { nome: 'Aluguel',            valor: 2200,   tipo: 'fixo',       cat: 'Moradia',    dia: 5,  obs: '' },
  { nome: 'Condomínio',         valor: 480,    tipo: 'fixo',       cat: 'Moradia',    dia: 10, obs: '' },
  { nome: 'Internet',           valor: 119.9,  tipo: 'fixo',       cat: 'Moradia',    dia: 12, obs: 'Fibra 500MB' },
  { nome: 'Plano de saúde',     valor: 640,    tipo: 'fixo',       cat: 'Saúde',      dia: 8,  obs: '' },
  { nome: 'Academia',           valor: 99.9,   tipo: 'recorrente', cat: 'Saúde',      dia: 15, obs: '' },
  { nome: 'Streaming',          valor: 55.9,   tipo: 'recorrente', cat: 'Lazer',      dia: 18, obs: '' },
  { nome: 'Curso de inglês',    valor: 320,    tipo: 'recorrente', cat: 'Educação',   dia: 20, obs: '' },
];

const mercados  = ['Supermercado Pão de Açúcar', 'Mercado Extra', 'Atacadão', 'Hortifruti'];
const comida    = ['iFood', 'Restaurante almoço', 'Padaria', 'Pizzaria', 'Cafeteria', 'Lanchonete'];
const transp    = ['Uber', '99', 'Posto de gasolina', 'Estacionamento', 'Recarga bilhete único'];
const lazer     = ['Cinema', 'Show', 'Bar com amigos', 'Livraria', 'Viagem fim de semana'];
const saude     = ['Farmácia', 'Consulta médica', 'Exame laboratorial', 'Dentista'];
const outros    = ['Presente aniversário', 'Cabeleireiro', 'Manutenção celular', 'Compra online'];

const hoje = new Date();
const rows = [];
const add = (desc, valor, tipo, cat, y, m, d, obs = '') =>
  rows.push([desc, valor, tipo, cat, iso(y, m, d), obs]);

for (let i = MESES - 1; i >= 0; i--) {
  const ref = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const ultimo = new Date(y, m + 1, 0).getDate();
  const limite = i === 0 ? hoje.getDate() : ultimo; // mês atual só até hoje
  const ok = (d) => d <= limite;

  // Salário (entrada, não é uma conta recorrente)
  if (ok(5)) add('Salário', 8500, 'entrada', 'Renda', y, m, 5, 'Crédito em conta');

  // Lançamentos dos recorrentes
  for (const r of recorrentes) {
    const d = Math.min(r.dia, ultimo);
    if (!ok(d)) continue;
    add(r.nome, r.valor, 'saida', r.cat, y, m, d, r.obs);
  }

  // Renda extra ocasional
  if (rnd() > 0.35 && ok(22)) add('Freelance', money(900, 2400), 'entrada', 'Renda', y, m, 22, 'Projeto avulso');
  if (m % 3 === 2 && ok(28)) add('Dividendos', money(180, 420), 'entrada', 'Renda', y, m, 28);

  // Mercado: 4 compras
  for (const d of [3, 11, 18, 26]) if (ok(d)) add(pick(mercados), money(160, 420), 'saida', 'Alimentação', y, m, d);
  // Comida fora: ~8 por mês
  for (let k = 0; k < 8; k++) {
    const d = 1 + Math.floor(rnd() * ultimo);
    if (ok(d)) add(pick(comida), money(22, 95), 'saida', 'Alimentação', y, m, d);
  }
  // Transporte
  for (let k = 0; k < 7; k++) {
    const d = 1 + Math.floor(rnd() * ultimo);
    if (ok(d)) add(pick(transp), money(14, 190), 'saida', 'Transporte', y, m, d);
  }
  // Saúde, lazer e outros
  for (let k = 0; k < 2; k++) {
    const d = 1 + Math.floor(rnd() * ultimo);
    if (ok(d)) add(pick(saude), money(35, 260), 'saida', 'Saúde', y, m, d);
  }
  for (let k = 0; k < 4; k++) {
    const d = 1 + Math.floor(rnd() * ultimo);
    if (ok(d)) add(pick(lazer), money(40, 280), 'saida', 'Lazer', y, m, d);
  }
  for (let k = 0; k < 2; k++) {
    const d = 1 + Math.floor(rnd() * ultimo);
    if (ok(d)) add(pick(outros), money(30, 220), 'saida', 'Outros', y, m, d);
  }
}

const tx = db.transaction(() => {
  db.prepare('DELETE FROM transactions WHERE user_id = ?').run(dono.id);
  db.prepare('DELETE FROM recorrentes  WHERE user_id = ?').run(dono.id);
  db.seedCategorias(dono.id);
  const contaId = contaPadrao(dono.id);

  const idDe = Object.fromEntries(
    db.prepare('SELECT id, nome FROM categorias WHERE user_id = ?').all(dono.id).map(c => [c.nome, c.id])
  );
  // Se a conta renomeou ou apagou uma categoria padrão, recria para não quebrar a carga.
  const categoriaId = nome => idDe[nome] ??= Number(
    db.prepare('INSERT INTO categorias (user_id, nome, cor) VALUES (?, ?, ?)').run(dono.id, nome, '#8b90a0').lastInsertRowid
  );
  const centavos = v => Math.round(v * 100);

  const insT = db.prepare('INSERT INTO transactions (user_id, conta_id, descricao, valor_centavos, tipo, categoria_id, data, obs) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  for (const [desc, valor, tipo, cat, data, obs] of rows) insT.run(dono.id, contaId, desc, centavos(valor), tipo, categoriaId(cat), data, obs);

  const insR = db.prepare('INSERT INTO recorrentes (user_id, nome, valor_centavos, tipo, categoria_id, dia, obs) VALUES (?, ?, ?, ?, ?, ?, ?)');
  for (const r of recorrentes) insR.run(dono.id, r.nome, centavos(r.valor), r.tipo, categoriaId(r.cat), r.dia, r.obs);

  // Liga cada lançamento mensal ao recorrente que o originou (é o que marca "lançado" na tela).
  db.prepare(`
    UPDATE transactions SET recorrente_id = (
      SELECT r.id FROM recorrentes r
      WHERE r.user_id = transactions.user_id AND r.nome = transactions.descricao AND r.categoria_id = transactions.categoria_id)
    WHERE user_id = ? AND tipo = 'saida'
  `).run(dono.id);
});
tx();

const resumo = db.prepare(`
  SELECT substr(data, 1, 7) AS mes,
         SUM(CASE WHEN tipo='entrada' THEN valor_centavos END) / 100.0 AS entradas,
         SUM(CASE WHEN tipo='saida'   THEN valor_centavos END) / 100.0 AS saidas,
         COUNT(*) AS lancamentos
  FROM transactions WHERE user_id = ? GROUP BY mes ORDER BY mes
`).all(dono.id);

console.log(`Carga gravada em ${process.env.DB_PATH} para ${dono.email}`);
console.table(resumo);
console.log(`${recorrentes.length} recorrentes, ${rows.length} lançamentos.`);
