// Cada arquivo de teste roda em processo próprio, então o banco em memória é isolado.
process.env.DB_PATH = ':memory:';
process.env.NODE_ENV = 'test';
// Os testes criam dezenas de contas do mesmo IP; o limite real de cadastros é testado em cadastro.test.js.
process.env.LIMITE_CADASTROS_POR_HORA ??= '100000';

const request = require('supertest');
const app = require('../app');
const db  = require('../db');
const { enviados } = require('../lib/email');

let seq = 0;

// Cria uma conta pela API e devolve um agente (com o cookie de sessão) já logado.
async function novoUsuario(nome = 'Fulana') {
  const email = `user${++seq}@teste.com`;
  const agente = request.agent(app);
  const res = await agente.post('/api/auth/registrar').send({ nome, email, senha: 'senha-segura-1' });
  if (res.status !== 201) throw new Error(`registro falhou: ${JSON.stringify(res.body)}`);
  return { agente, email, id: res.body.user.id, senha: 'senha-segura-1' };
}

// O app exige e-mail confirmado só para avisos automáticos; nos testes marcamos direto no banco.
function confirmarEmail(id) {
  db.prepare('UPDATE users SET email_verificado_em = ? WHERE id = ?').run(new Date().toISOString(), id);
}

// Último e-mail enviado para o endereço, ou undefined.
const ultimoEmail = para => [...enviados].reverse().find(e => e.para === para);
const emailsPara  = para => enviados.filter(e => e.para === para);

// Extrai o token de um link `?chave=TOKEN` do texto do e-mail.
const tokenDoEmail = (email, chave) => decodeURIComponent(email.texto.match(new RegExp(`${chave}=([^\\s]+)`))[1]);

function virarAdmin(id) {
  db.prepare("UPDATE users SET papel = 'superadmin' WHERE id = ?").run(id);
}

const categoriaDe = async (agente, nome) =>
  (await agente.get('/api/categorias')).body.find(c => c.nome === nome);

module.exports = { app, db, request, novoUsuario, virarAdmin, categoriaDe, confirmarEmail, ultimoEmail, emailsPara, tokenDoEmail, enviados };
