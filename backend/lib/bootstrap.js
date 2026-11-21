// Contas iniciais criadas ao subir a API, configuradas por variáveis de ambiente (ex.: no .env).
// Pensado para ambientes de teste e demonstração: quem sobe o app já tem com o que entrar, sem rodar comandos.
//
//   BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_SENHA [/ BOOTSTRAP_ADMIN_NOME]   super admin
//   BOOTSTRAP_DEMO=true [/ BOOTSTRAP_DEMO_EMAIL / BOOTSTRAP_DEMO_SENHA]      usuário com 5 meses de dados de exemplo
//
// Regras de segurança: só CRIA. Se o e-mail já existe, não mexe em nada (nem na senha, nem nos dados), então
// reiniciar a API nunca desfaz o que a pessoa mudou. Nada aqui registra a senha em log.
const db = require('../db');
const { hashSenha } = require('./auth');
const { popularDemo } = require('./demo');
const logger = require('./logger');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SENHA_MIN = 8;

const buscar = email => db.prepare('SELECT id, papel FROM users WHERE email = ?').get(email);

// Cria a conta já com e-mail confirmado (quem configurou o ambiente é o dono do endereço) e o básico de uma conta nova.
const criar = db.transaction(({ nome, email, senha, papel }) => {
  const id = Number(db.prepare(
    'INSERT INTO users (nome, email, senha_hash, papel, status, criado_em, email_verificado_em) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(nome, email, hashSenha(senha), papel, 'ativo', new Date().toISOString(), new Date().toISOString()).lastInsertRowid);
  // Dados antigos sem dono (de antes das contas) passam para o primeiro admin, como no create-admin.
  if (papel === 'superadmin') db.adoptOrphans(id);
  db.seedCategorias(id);
  db.seedContas(id);
  return id;
});

function dadosValidos(email, senha, rotulo) {
  if (!EMAIL_RE.test(email)) { logger.warn({ rotulo }, 'bootstrap ignorado: e-mail inválido'); return false; }
  if (senha.length < SENHA_MIN) { logger.warn({ rotulo, email }, `bootstrap ignorado: a senha precisa de ao menos ${SENHA_MIN} caracteres`); return false; }
  return true;
}

// Devolve o que aconteceu com cada conta: 'criada', 'existente', 'ignorada' ou null (não configurada).
function criarContasIniciais(env = process.env) {
  const resultado = { admin: null, demo: null };

  const adminEmail = (env.BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase();
  const adminSenha = env.BOOTSTRAP_ADMIN_SENHA || '';
  if (adminEmail || adminSenha) {
    if (!dadosValidos(adminEmail, adminSenha, 'admin')) resultado.admin = 'ignorada';
    else if (buscar(adminEmail)) resultado.admin = 'existente';
    else {
      criar({ nome: (env.BOOTSTRAP_ADMIN_NOME || 'Administrador').trim().slice(0, 60), email: adminEmail, senha: adminSenha, papel: 'superadmin' });
      resultado.admin = 'criada';
      logger.info({ email: adminEmail }, 'super admin criado pelo bootstrap');
    }
  }

  if (String(env.BOOTSTRAP_DEMO).toLowerCase() === 'true') {
    const email = (env.BOOTSTRAP_DEMO_EMAIL || 'demo@finanza.local').trim().toLowerCase();
    const senha = env.BOOTSTRAP_DEMO_SENHA || 'demo1234';
    if (!dadosValidos(email, senha, 'demo')) resultado.demo = 'ignorada';
    else if (buscar(email)) resultado.demo = 'existente';
    else {
      const id = criar({ nome: 'Conta demo', email, senha, papel: 'user' });
      popularDemo({ id });
      resultado.demo = 'criada';
      logger.info({ email }, 'conta demo criada pelo bootstrap');
    }
  }

  if (process.env.NODE_ENV === 'production' && (resultado.admin === 'criada' || resultado.demo === 'criada')) {
    logger.warn('Contas de bootstrap criadas em produção: troque as senhas e remova BOOTSTRAP_* do ambiente.');
  }
  return resultado;
}

module.exports = { criarContasIniciais };
