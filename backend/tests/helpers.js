// Cada arquivo de teste roda em processo próprio, então o banco em memória é isolado.
process.env.DB_PATH = ':memory:';

const request = require('supertest');
const app = require('../app');
const db  = require('../db');

let seq = 0;

// Cria uma conta pela API e devolve um agente (com o cookie de sessão) já logado.
async function novoUsuario(nome = 'Fulana') {
  const email = `user${++seq}@teste.com`;
  const agente = request.agent(app);
  const res = await agente.post('/api/auth/registrar').send({ nome, email, senha: 'senha-segura-1' });
  if (res.status !== 201) throw new Error(`registro falhou: ${JSON.stringify(res.body)}`);
  return { agente, email, id: res.body.user.id, senha: 'senha-segura-1' };
}

function virarAdmin(id) {
  db.prepare("UPDATE users SET papel = 'superadmin' WHERE id = ?").run(id);
}

const categoriaDe = async (agente, nome) =>
  (await agente.get('/api/categorias')).body.find(c => c.nome === nome);

module.exports = { app, db, request, novoUsuario, virarAdmin, categoriaDe };
