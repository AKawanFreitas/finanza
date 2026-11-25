// Com TRUST_PROXY, o X-Forwarded-For define o IP de cada cadastro.
process.env.TRUST_PROXY = '1';
const test = require('node:test');
const assert = require('node:assert/strict');
const { request, app, emailsPara } = require('./helpers');

const registrar = (email, ip) =>
  request(app).post('/api/auth/registrar').set('X-Forwarded-For', ip).send({ nome: 'Teste', email, senha: 'senha-segura-1' });

test('o mesmo IP cria no máximo LIMITE_CADASTROS_POR_HORA contas, e o excesso não dispara e-mail', async () => {
  const antes = process.env.LIMITE_CADASTROS_POR_HORA;
  process.env.LIMITE_CADASTROS_POR_HORA = '3';
  try {
    for (let i = 0; i < 3; i++) assert.equal((await registrar(`massa${i}@teste.com`, '198.51.100.50')).status, 201);
    const excesso = await registrar('vitima@gmail.com', '198.51.100.50');
    assert.equal(excesso.status, 429);
    assert.match(excesso.body.error, /Muitas contas/);
    assert.equal(emailsPara('vitima@gmail.com').length, 0, 'nenhum e-mail vai para o endereço do excesso');
    assert.equal((await registrar('outra@teste.com', '192.0.2.77')).status, 201, 'outro IP segue normal');
  } finally {
    if (antes === undefined) delete process.env.LIMITE_CADASTROS_POR_HORA; else process.env.LIMITE_CADASTROS_POR_HORA = antes;
  }
});
