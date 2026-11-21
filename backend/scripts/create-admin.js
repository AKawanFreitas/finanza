// Cria ou promove o super admin. Ninguém vira administrador pela tela.
//
//   npm run create-admin -- --email voce@exemplo.com --nome "Seu Nome"
//   npm run create-admin -- --email voce@exemplo.com --senha "sua senha"
//
// Sem --senha, o comando gera uma provisória e pede a troca no primeiro acesso.
// Em um banco que já tinha dados sem dono, eles passam para esta conta.
require('../lib/env').carregarEnv(); // DB_PATH / BACKUP_DIR do .env, se houver
const readline = require('readline');
const db   = require('../db');
const auth = require('../lib/auth');

function argumentos(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const chave = argv[i];
    if (!chave.startsWith('--')) continue;
    out[chave.slice(2)] = argv[i + 1]?.startsWith('--') ? true : argv[++i];
  }
  return out;
}

function perguntar(texto) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(texto, resposta => { rl.close(); resolve(resposta.trim()); }));
}

async function main() {
  const args  = argumentos(process.argv.slice(2));
  const email = String(args.email || await perguntar('E-mail do administrador: ')).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    console.error('E-mail inválido.');
    process.exit(1);
  }

  const senhaInformada = typeof args.senha === 'string' ? args.senha : null;
  if (senhaInformada && senhaInformada.length < 8) {
    console.error('A senha deve ter pelo menos 8 caracteres.');
    process.exit(1);
  }
  const senha = senhaInformada || auth.senhaProvisoria();
  const existente = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

  let id;
  if (existente) {
    // Conta já existe: vira administrador. A senha só muda se foi informada.
    const aplicar = db.transaction(() => {
      db.prepare("UPDATE users SET papel = 'superadmin', status = 'ativo' WHERE id = ?").run(existente.id);
      if (senhaInformada) {
        db.prepare('UPDATE users SET senha_hash = ?, trocar_senha = 0 WHERE id = ?')
          .run(auth.hashSenha(senhaInformada), existente.id);
        auth.encerrarSessoesDe(existente.id);
      }
    });
    aplicar();
    id = existente.id;
    console.log(`Conta ${email} agora é super admin.`);
    if (senhaInformada) console.log('Senha atualizada; as sessões abertas foram encerradas.');
  } else {
    const nome = String(args.nome || await perguntar('Nome: ') || 'Administrador').trim();
    const criar = db.transaction(() => {
      const { lastInsertRowid } = db.prepare(
        'INSERT INTO users (nome, email, senha_hash, papel, status, trocar_senha, criado_em, email_verificado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(nome, email, auth.hashSenha(senha), 'superadmin', 'ativo', senhaInformada ? 0 : 1, new Date().toISOString(), new Date().toISOString());
      return Number(lastInsertRowid);
    });
    id = criar();
    console.log(`Super admin criado: ${nome} <${email}>`);
    if (!senhaInformada) {
      console.log(`Senha provisória: ${senha}`);
      console.log('Você vai precisar trocá-la no primeiro acesso.');
    }
  }

  // Adotar primeiro preserva as categorias antigas; só se não houver nenhuma criamos as padrão.
  const adotados = db.adoptOrphans(id);
  if (adotados > 0) console.log(`${adotados} registro(s) que estavam sem dono passaram para esta conta.`);
  db.seedCategorias(id);
  db.seedContas(id);
}

main().catch(err => { console.error(err.message); process.exit(1); });
