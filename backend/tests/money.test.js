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
