const test = require('node:test');
const assert = require('node:assert/strict');
const { paraCentavos, paraReais } = require('../lib/money');

test('converte reais em centavos sem erro de ponto flutuante', () => {
  assert.equal(paraCentavos(0.1 + 0.2), 30);
  assert.equal(paraCentavos(19.99), 1999);
  assert.equal(paraCentavos(1.005), 101);
  assert.equal(paraCentavos('12.34'), 1234);
  assert.equal(paraCentavos(8500), 850000);
});

test('rejeita valores inválidos', () => {
  for (const v of [0, -1, NaN, Infinity, '', '  ', 'abc', null, undefined, 0.004, 1e12]) {
    assert.equal(paraCentavos(v), null, `deveria rejeitar ${String(v)}`);
  }
});

test('converte centavos em reais', () => {
  assert.equal(paraReais(1999), 19.99);
  assert.equal(paraReais(5), 0.05);
});

test('validarValor: aceita número ou texto com ponto e até 2 casas', () => {
  const { validarValor } = require('../lib/money');
  assert.deepEqual(validarValor(12.5), { centavos: 1250 });
  assert.deepEqual(validarValor('1234.56'), { centavos: 123456 });
  assert.deepEqual(validarValor(' 10 '), { centavos: 1000 });
  assert.deepEqual(validarValor(0.1 + 0.2), { centavos: 30 });
  assert.deepEqual(validarValor(-50, { sinal: true }), { centavos: -5000 });
});

test('validarValor: recusa hexadecimal, notação científica, 3 casas e acima de R$ 1 bilhão, com a mensagem certa', () => {
  const { validarValor } = require('../lib/money');
  for (const v of ['0x10', '1e3', '12,50', 'R$ 10', '', 'abc', NaN, Infinity, true, null]) {
    assert.match(validarValor(v).erro ?? '', /número|inválido/i, `deveria recusar ${String(v)}`);
  }
  assert.match(validarValor(10.999).erro, /2 casas/);
  assert.match(validarValor('1.005').erro, /2 casas/);
  assert.match(validarValor(1000000000.01).erro, /1 bilhão/);
  assert.match(validarValor(-5).erro, /maior que zero/);
  assert.match(validarValor(0).erro, /maior que zero/);
});
